import type {
  DocumentId,
  NetworkAdapter,
  PeerId,
  RepoMessage,
  StorageAdapter,
} from '@automerge/automerge-repo'
import * as Auth from '@localfirst/auth'
import { debug } from '@localfirst/auth-shared'
import { EventEmitter } from 'eventemitter3'
import { pack, unpack } from 'msgpackr'
import { AuthenticatedNetworkAdapter as AuthNetworkAdapter } from './AuthenticatedNetworkAdapter.js'
import { forwardEvents } from './forwardEvents.js'
import type {
  AuthProviderEvents,
  Config,
  Invitation,
  LocalFirstAuthMessage,
  LocalFirstAuthMessagePayload,
  SerializedShare,
  SerializedState,
  Share,
  ShareId,
} from './types.js'
import { isAuthMessage, isDeviceInvitation } from './types.js'
import { CompositeMap } from './CompositeMap.js'

const { encryptBytes, decryptBytes } = Auth.symmetric

/**
 * This class is used to wrap automerge-repo network adapters so that they authenticate peers and
 * encrypt network traffic, using [localfirst/auth](https://github.com/local-first-web/auth).
 *
 * To use:
 *
 * 1. Create a AuthProvider, using the same storage adapter that the repo will use:
 *
 *    ```ts
 *    const storage = new SomeStorageAdapter()
 *    const auth = new AuthProvider({ user, device, storage })
 *    ```
 * 2. Wrap your network adapter(s) with its `wrap` method.
 *    ```ts
 *   const adapter = new SomeNetworkAdapter()
 *   const authenticatedAdapter = auth.wrap(adapter)
 *   ```
 * 3. Pass the wrapped adapters to the repo.
 *   ```ts
 *  const repo = new Repo({
 *    storage,
 *    network: [authenticatedAdapter],
 *  })
 */
export class AuthProvider extends EventEmitter<AuthProviderEvents> {
  readonly #device: Auth.DeviceWithSecrets
  #user?: Auth.UserWithSecrets
  readonly storage: StorageAdapter

  readonly #adapters: Array<AuthNetworkAdapter<NetworkAdapter>> = []
  readonly #invitations = new Map<ShareId, Invitation>()
  readonly #shares = new Map<ShareId, Share>()
  readonly #connections = new CompositeMap<[ShareId, PeerId], Auth.Connection>()
  readonly #storedMessages = new CompositeMap<[ShareId, PeerId], Uint8Array[]>()
  readonly #peers = new Map<NetworkAdapter, PeerId[]>()

  #log = debug.extend('auth:provider-automerge-repo')

  constructor({ device, user, storage }: Config) {
    super()

    // We always are given the local device's info & keys
    this.#device = device

    // We might already have our user info, unless we're a new device using an invitation
    if (user?.userName) {
      this.#user = user
      this.#log = this.#log.extend(user.userName)
    }

    this.#log('instantiating %o', {
      userName: user?.userName,
      deviceId: device.deviceId,
    })
    // Load any existing state from storage
    this.storage = storage
    this.#loadState()
      .then(() => this.emit('ready'))
      .catch(error => {
        throw error as Error
      })
  }

  /**
   * Intercept the network adapter's events. For each new peer, we create a localfirst/auth
   * connection and use it to mutually authenticate before forwarding the peer-candidate event.
   */
  wrap = (baseAdapter: NetworkAdapter) => {
    // All repo messages for this adapter are handled by the Auth.Connection, which encrypts them
    // and guarantees authenticity.
    const send = (message: RepoMessage) => {
      this.#log('sending message from connection %o', message)
      const shareId = this.#getShareIdForMessage(message)
      const connection = this.#getConnection(shareId, message.targetId)
      connection.send(message)
    }
    const authAdapter = new AuthNetworkAdapter(baseAdapter, send)

    // try to authenticate new peers; if we succeed, we forward the peer-candidate to the network subsystem
    baseAdapter
      .on('peer-candidate', ({ peerId }) => {
        // TODO: we need to store the storageId and isEphemeral in order to provide that info in the peer-candidate event

        this.#log('peer-candidate %o', peerId)
        this.#addPeer(baseAdapter, peerId)

        // We optimistically spin up a connection for each share we have and every unused invitation
        // we have. Messages regarding shares we're not a member of will be ignored.
        for (const shareId of this.#allShareIds())
          void this.#createConnection({ shareId, peerId, authAdapter })
      })

      // Intercept any incoming messages and pass them to the Auth.Connection.
      .on('message', message => {
        this.#log('message from adapter %o', message)

        if (!isAuthMessage(message)) throw new Error('Not an auth message')
        const { senderId, payload } = message
        const { shareId, serializedConnectionMessage } = payload as LocalFirstAuthMessagePayload

        // If we don't have a connection for this message, store it until we do
        if (!this.#connections.has([shareId, senderId])) {
          this.#log(
            `didn't find connection for [${shareId}, ${senderId}]. available keys: %o`,
            this.#connections.keys()
          )
          this.#storeMessage(shareId, senderId, serializedConnectionMessage)
          return
        }

        // Pass message to the auth connection
        const connection = this.#getConnection(shareId, senderId)

        this.#log('delivering message to connection %o', message)
        connection.deliver(serializedConnectionMessage)
      })

      .on('peer-disconnected', ({ peerId }) => {
        this.#log('peer-disconnected %o', peerId)
        // Disconnect all connections with this peer
        for (const shareId of this.#allShareIds()) {
          if (this.#connections.has([shareId, peerId])) {
            this.#disconnect(shareId, peerId)
          }
        }
      })

    // forward all other events from the base adapter to the repo
    forwardEvents(baseAdapter, authAdapter, ['ready', 'close', 'peer-disconnected', 'error'])

    this.#adapters.push(authAdapter)
    return authAdapter
  }

  public async addTeam(team: Auth.Team) {
    this.#log('adding team %o', team.teamName)
    const shareId = team.id
    const share: Share = { shareId, team, documentIds: new Set() }
    this.#shares.set(shareId, share)
    await this.#saveState()
    team.on('updated', async () => {
      await this.#saveState()
    })
    await this.#createConnectionsForShare(shareId)
  }

  public getTeam(shareId: ShareId) {
    const share = this.#shares.get(shareId)
    if (!share) throw new Error(`Share not found`)
    return share.team
  }

  public async addInvitation(invitation: Invitation) {
    const { shareId } = invitation
    this.#invitations.set(shareId, invitation)
    await this.#createConnectionsForShare(shareId)
  }

  // eslint-disable-next-line unused-imports/no-unused-vars
  public addDocuments(shareId: ShareId, documentIds: DocumentId[]) {
    throw new Error('not implemented')
    // const share = this.getShare(shareId)
    // documentIds.forEach(id => share.documentIds.add(id))
  }

  // eslint-disable-next-line unused-imports/no-unused-vars
  public removeDocuments(shareId: ShareId, documentIds: DocumentId[]) {
    throw new Error('not implemented')
    // const share = this.getShare(shareId)
    // documentIds.forEach(id => share.documentIds.delete(id))
  }

  // PRIVATE

  /**
   * We might get messages from a peer before we've set up an Auth.Connection with them.
   * We store these messages until there's a connection to hand them off to.
   */
  readonly #storeMessage = (shareId: ShareId, peerId: PeerId, message: Uint8Array) => {
    const messages = this.#getStoredMessages(shareId, peerId)
    this.#storedMessages.set([shareId, peerId], [...messages, message])
  }

  readonly #getStoredMessages = (shareId: ShareId, peerId: PeerId) => {
    return this.#storedMessages.get([shareId, peerId]) ?? []
  }

  /**
   * An Auth.Connection executes the localfirst/auth protocol to authenticate a peer, negotiate a
   * shared secret key for the session, and sync up the team graph. This communication happens
   * over a network adapter that we've wrapped.
   */
  readonly #createConnection = async <T extends NetworkAdapter>({
    shareId,
    peerId,
    authAdapter,
  }: {
    shareId: ShareId
    peerId: PeerId
    authAdapter: AuthNetworkAdapter<T>
  }) => {
    this.#log('creating connection %o', { shareId, peerId })
    const { baseAdapter } = authAdapter

    const connection = new Auth.Connection({
      context: this.#getContextForShare(shareId),
      // The Auth connection uses the base adapter as its network transport
      sendMessage(serializedConnectionMessage) {
        const authMessage: LocalFirstAuthMessage = {
          type: 'auth',
          senderId: baseAdapter.peerId!,
          targetId: peerId,
          payload: { shareId, serializedConnectionMessage },
        }
        baseAdapter.send(authMessage)
      },
    })

    connection
      .on('joined', async ({ team, user }) => {
        // When we successfully join a team, the connection gives us the team graph and the user's
        // info (including keys). (When we're joining as a new device for an existing user, this
        // is how we get the user's keys.)

        if (user !== this.#user) this.#log = this.#log.extend(user.userName)

        // Create a share with this team
        this.#user = user

        await this.addTeam(team)

        await this.#saveState()

        // remove the used invitation as we no longer need it & don't want to present it to others
        this.#invitations.delete(shareId)

        // Let the application know
        this.emit('joined', { shareId, peerId, team, user })
      })

      .on('connected', () => {
        // Let the application know
        this.emit('connected', { shareId, peerId })
        // Let the repo know we've got a new peer
        authAdapter.emit('peer-candidate', { peerId, peerMetadata: {} })
      })

      .on('message', message => {
        // Forward messages that arrive via the connection's encrypted channel to the repo
        authAdapter.emit('message', message as RepoMessage)
      })

      .on('updated', async () => {
        // Team state has changed, so save our entire state
        await this.#saveState()
      })

      .on('localError', event => {
        // These are errors that are detected locally, e.g. a peer tries to join with an invalid
        // invitation
        this.#log(`localError: ${JSON.stringify(event)}`)

        // Let the application know, e.g. to let me decide if I want to allow the peer to retry
        this.emit('localError', { shareId, peerId, ...event })
      })

      .on('remoteError', event => {
        // These are errors that are detected on the peer and reported to us, e.g. a peer rejects
        // an invitation we tried to join with
        this.#log(`remoteError: ${JSON.stringify(event)}`)

        // Let the application know, e.g. to let me retry
        this.emit('remoteError', { shareId, peerId, ...event })
      })

      .on('disconnected', event => {
        this.#disconnect(shareId, peerId, event)
      })

    connection.start()

    // If we already had messages for this peer, pass them to the connection
    for (const message of this.#getStoredMessages(shareId, peerId)) connection.deliver(message)

    // Track the connection
    this.#connections.set([shareId, peerId], connection)
  }

  #addPeer(baseAdapter: NetworkAdapter, peerId: PeerId) {
    this.#log('adding peer %o', peerId)

    // Track each peer by the adapter uses to connect to it
    const peers = this.#peers.get(baseAdapter) ?? []
    if (!peers.includes(peerId)) {
      peers.push(peerId)
      this.#peers.set(baseAdapter, peers)
    }
  }

  #disconnect(shareId: ShareId, peerId: PeerId, event?: Auth.ConnectionMessage) {
    this.#removeConnection(shareId, peerId)

    // Let the application know
    this.emit('disconnected', { shareId, peerId, event })

    // Let the repo know
    for (const authAdapter of this.#adapters) {
      // Find the adapter that has this peer
      const peers = this.#peers.get(authAdapter.baseAdapter) ?? []
      if (peers.includes(peerId)) {
        authAdapter.emit('peer-disconnected', { peerId })
        break
      }
    }
  }

  readonly #getConnection = (shareId: ShareId, peerId: PeerId) => {
    const connection = this.#connections.get([shareId, peerId])
    if (!connection) throw new Error(`Connection not found for peer ${peerId} on share ${shareId}`)
    return connection
  }

  readonly #removeConnection = (shareId: ShareId, peerId: PeerId) => {
    const connection = this.#connections.get([shareId, peerId])
    if (connection) {
      connection.stop()
      this.#connections.delete([shareId, peerId])
    }
  }

  /** Saves a serialized and partially encrypted version of the state */
  async #saveState() {
    const shares = {} as SerializedState
    for (const share of this.#shares.values()) {
      const { shareId, team, documentIds } = share
      shares[shareId] = {
        shareId,
        encryptedTeam: share.team.save(),
        encryptedTeamKeys: encryptBytes(team.teamKeyring(), this.#device.keys.secretKey),
        documentIds: Array.from(documentIds ?? []),
      } as SerializedShare
    }
    const serializedState = pack(shares)

    await this.storage.save(STORAGE_KEY, serializedState)
  }

  /** Loads and decrypts state from its serialized, persisted form */
  async #loadState() {
    const serializedState = await this.storage.load(STORAGE_KEY)
    if (!serializedState) return

    const savedShares = unpack(serializedState) as SerializedState

    await Promise.all(
      Object.values(savedShares).map(async share => {
        const { shareId, encryptedTeam, encryptedTeamKeys } = share
        this.#log('loading state', shareId)

        const teamKeys = decryptBytes(
          encryptedTeamKeys,
          this.#device.keys.secretKey
        ) as Auth.KeysetWithSecrets

        const context = { device: this.#device, user: this.#user }

        const team = await Auth.loadTeam(encryptedTeam, context, teamKeys)
        return this.addTeam(team)
      })
    )
  }

  #allShareIds() {
    return [...this.#shares.keys(), ...this.#invitations.keys()]
  }

  readonly #getContextForShare = (shareId: ShareId) => {
    const device = this.#device
    const user = this.#user
    const invitation = this.#invitations.get(shareId)
    const share = this.#shares.get(shareId)
    if (share)
      // this is a share we're already a member of
      return {
        device,
        user,
        team: share.team,
      } as Auth.MemberContext
    else if (invitation)
      if (isDeviceInvitation(invitation))
        // this is a share we've been invited to as a device
        return {
          device,
          ...invitation,
        } as Auth.InviteeDeviceContext
      else {
        // this is a share we've been invited to as a member
        return {
          device,
          user,
          ...invitation,
        } as Auth.InviteeMemberContext
      }

    // we don't know about this share
    throw new Error(`no context for ${shareId}`)
  }

  /** Go through all our peers and try to connect in case they're on the team */
  async #createConnectionsForShare(shareId: ShareId) {
    this.#log('createConnectionsForShare', shareId)
    await Promise.all(
      this.#adapters.map(async authAdapter => {
        const peerIds = this.#peers.get(authAdapter.baseAdapter) ?? []
        this.#log('creating connections for %o', peerIds)
        return peerIds.map(async peerId => {
          const connection = this.#connections.get([shareId, peerId])
          if (!connection) {
            return this.#createConnection({ shareId, peerId, authAdapter })
          }
        })
      })
    )
  }

  /** Returns the shareId to use for encrypting the given message */
  readonly #getShareIdForMessage = ({ targetId }: RepoMessage) => {
    // Since the raw network adapters don't know anything about ShareIds, when we're given a message
    // to encrypt and send out, we need to figure out which auth connection it belongs to, in order
    // to retrieve the right session key to use for encryption.

    // First we need to find all shareIds for which we have connections with the target peer
    const shareIdsForPeer = this.#allShareIds().filter(shareId =>
      this.#connections.has([shareId, targetId])
    )

    if (shareIdsForPeer.length === 0) {
      throw new Error(`No share found for peer ${targetId} `)
    }

    // Typically there should be exactly one shareId for a given peer
    if (shareIdsForPeer.length === 1) return shareIdsForPeer[0]

    // However it's possible to have multiple auth connections with the same peer (one for each
    // share we're both a member of). To figure out which one to use, we need to look at the
    // documentId. If the same documentId is included in multiple shares with the same peer, we can
    // use any of those session keys, but we need to pick one consistently.

    // TODO: use documentId to pick the right share
    // For now, just pick the lowest ShareId
    return shareIdsForPeer.sort()[0]
  }
}

const STORAGE_KEY = ['AuthProvider', 'shares']
