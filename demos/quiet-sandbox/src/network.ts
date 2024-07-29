import { createLibp2p, type Libp2p } from 'libp2p'
import { bootstrap } from '@libp2p/bootstrap'
import { tcp } from '@libp2p/tcp'
import { echo } from '@libp2p/echo'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { createFromPrivKey, createFromProtobuf, exportToProtobuf } from '@libp2p/peer-id-factory'
import { base64 } from 'multiformats/bases/base64'
import { createHelia, type Helia } from 'helia'
import { createOrbitDB, type Events, Identities, KeyStore, type KeyValue, LogEntry, OrbitDB, OrbitDBAccessController } from '@orbitdb/core'
import { GossipSub, gossipsub } from '@chainsafe/libp2p-gossipsub'
import { identify } from '@libp2p/identify'
import fs from 'fs'
import { EventEmitter } from 'events'
import * as Auth from '@localfirst/auth'
import type { ConnectionEvents } from '@localfirst/auth'
import type {
  Connection,
  PeerId,
  PeerStore,
  ComponentLogger,
  Topology,
  Stream,
  RSAPeerId,
  Ed25519PeerId,
  Secp256k1PeerId,
  KeyType
} from '@libp2p/interface'
import type { ConnectionManager, IncomingStreamData, Registrar } from '@libp2p/interface-internal'
import { pipe } from 'it-pipe'
import { encode, decode } from 'it-length-prefixed'
import { pushable, type Pushable } from 'it-pushable'
import type { Uint8ArrayList } from 'uint8arraylist'
import map from 'it-map'
import { SigChain } from './auth/chain.js'
import { UserService } from './auth/services/members/userService.js';
import { multiaddr, Multiaddr } from '@multiformats/multiaddr';
import { EncryptedAndSignedPayload } from './auth/services/crypto/types.js'
import { MemoryDatastore } from 'datastore-core'
import { generateKeyPairFromSeed } from '@libp2p/crypto/keys'
import path from 'path'

export class LocalStorage {
    private authContext: Auth.Context | null
    private context: Auth.LocalUserContext | null
    private sigChain: SigChain | null

    constructor() {        
        this.authContext = null
        this.context = null
        this.sigChain = null
    }

  public setAuthContext(context: Auth.Context) {
    this.authContext = context
  }

  public getAuthContext(): Auth.Context | null {
    return this.authContext
  }

  public setSigChain(sigChain: SigChain) {
    this.sigChain = sigChain
}

public setContext(context: Auth.LocalUserContext) {
    this.context = context
}

  public getSigChain(): SigChain | null {
    return this.sigChain
    }

public getContext(): Auth.LocalUserContext | null {
        return this.context
    }
}

interface Libp2pAuthComponents {
  peerId: PeerId
  peerStore: PeerStore
  registrar: Registrar
  connectionManager: ConnectionManager
  logger: ComponentLogger
}

// Implementing local-first-auth as a service just to get started. I think we
// likely want to integrate it in a custom Transport/Muxer.
class Libp2pAuth {
  private readonly protocol: string
  private readonly components: Libp2pAuthComponents
  private storage: LocalStorage
  private authConnections: Record<string, Auth.Connection>
  private outboundStreamQueue: Pushable<{ peerId: PeerId, connection: Connection }>
  private outboundStreams: Record<string, Pushable<Uint8Array | Uint8ArrayList>>
  private inboundStreams: Record<string, Stream>

  constructor(storage: LocalStorage, components: Libp2pAuthComponents) {
    this.protocol = '/local-first-auth/1.0.0'
    this.components = components
    this.storage = storage
    this.authConnections = {}
    this.outboundStreamQueue = pushable<{ peerId: PeerId, connection: Connection }>({ objectMode: true })
    this.outboundStreams = {}
    this.inboundStreams = {}

    pipe(
      this.outboundStreamQueue,
      async (source) => {
        for await (const { peerId, connection } of source) {
          await this.openOutboundStream(peerId, connection)
        }
      }
    ).catch((e) => { console.error('Outbound stream queue error', e) })
  }

  async start() {
    console.log('Auth service starting')

    const topology: Topology = {
      onConnect: this.onPeerConnected.bind(this),
      onDisconnect: this.onPeerDisconnected.bind(this),
      notifyOnTransient: false,
    }

    const registrar = this.components.registrar
    await registrar.register(this.protocol, topology)
    await registrar.handle(this.protocol, this.onIncomingStream.bind(this), {
      runOnTransientConnection: false
    })
  }

  async stop() {
    // TODO
  }

  private async openOutboundStream(peerId: PeerId, connection: Connection) {
    if (peerId.toString() in this.outboundStreams) {
      return
    }

    console.log('Opening outbound stream for peer', peerId.toString())
    const outboundStream = await connection.newStream(this.protocol, {
      runOnTransientConnection: false
    })
    const outboundPushable: Pushable<Uint8Array | Uint8ArrayList> = pushable()
    this.outboundStreams[peerId.toString()] = outboundPushable

    pipe(
      outboundPushable,
      outboundStream
    ).catch((e: Error) => console.error(e))

    this.authConnections[peerId.toString()].start()
  }

  private sendMessage(peerId: PeerId, message: Uint8Array) {
    this.outboundStreams[peerId.toString()]?.push(
      // length-prefix encoded
      encode.single(message)
    )
  }

  // NOTE: This is not awaited by the registrar
  private async onPeerConnected(peerId: PeerId, connection: Connection) {
    console.log('Peer connected!')

    // https://github.com/ChainSafe/js-libp2p-gossipsub/issues/398
    if (connection.status !== 'open') {
      return
    }

    if (peerId.toString() in this.authConnections) {
      await connection.close()
      return
    }

    const context = this.storage.getAuthContext()
    if (!context) {
      throw new Error('Auth context required to connect to peer')
    }

    this.outboundStreamQueue.push({ peerId, connection })

    const authConnection = new Auth.Connection({
      context,
      sendMessage: (message: Uint8Array) => {
        this.sendMessage(peerId, message)
      },
    })

    // TODO: Listen for updates to context and update context in storage
    authConnection.on('joined', ({ team, user }) => {
        console.log(`${user.userId}: Joined team ${team.teamName}!`)
        if (this.storage.getSigChain() == null) {
            console.log(`${user.userId}: Creating SigChain for user with name ${user.userName} and team name ${team.teamName}`)
            const context = this.storage.getContext()!
            this.storage.setSigChain(SigChain.createFromTeam(team, context).sigChain)
            console.log(`${user.userId}: Updating auth context`)
            this.storage.setAuthContext({
                user: context.user,
                device: context.device,
                team
            })
        }
    })

    authConnection.on('change', state => console.log(`${this.storage.getContext()?.user.userName} Change:`, state))

    this.authConnections[peerId.toString()] = authConnection
  }

  private onPeerDisconnected(peerId: PeerId): void {
    // TODO
  }

  private async onIncomingStream({ stream, connection }: IncomingStreamData) {
    const peerId = connection.remotePeer

    const oldStream = this.inboundStreams[peerId.toString()]
    if (oldStream) {
      oldStream.close().catch(e => {
        oldStream.abort(e)
      })
    }

    pipe(
      stream,
      (source) => decode(source),
      async (source) => {
        for await (const data of source) {
          try {
            this.authConnections[peerId.toString()].deliver(data.subarray())
          } catch (e) {
            console.error(e)
          }
        }
      }
    )

    this.inboundStreams[peerId.toString()] = stream
    console.log('New incoming stream for peer', peerId.toString())

    this.outboundStreamQueue.push({ peerId, connection })
  }
}

const libp2pAuth = (storage: LocalStorage): ((components: Libp2pAuthComponents) => Libp2pAuth) => {
  return (components: Libp2pAuthComponents) => new Libp2pAuth(storage, components)
}

export class Libp2pService {

  peerName: string
  libp2p: Libp2p | null
  storage: LocalStorage
  peerId: RSAPeerId | Ed25519PeerId | Secp256k1PeerId | null

  constructor(peerName: string, storage: LocalStorage) {
    this.peerName = peerName
    this.libp2p = null
    this.storage = storage
    this.peerId = null
  }

  /**
   * Get a persistent peer ID for a given name.
   */
  async getPeerId(): Promise<RSAPeerId | Ed25519PeerId | Secp256k1PeerId> {
    if (this.peerId != null) {
      return this.peerId
    }

    let peerIdFilename = '.peerId.' + this.peerName
    let peerIdB64

    try {
      peerIdB64 = fs.readFileSync(peerIdFilename, 'utf8')
    } catch (e) {
      console.error(e)
    }

    if (!peerIdB64) {
      console.log('Creating peer ID')
      const keys: Auth.KeysetWithSecrets = this.storage.getContext()?.user!.keys
      
      const buf = Buffer.from(keys.encryption.secretKey)
      const priv = await generateKeyPairFromSeed("Ed25519", new Uint8Array(buf).subarray(0, 32))
      const peerId = await createFromPrivKey(priv)
      const peerIdBytes = exportToProtobuf(peerId)
      peerIdB64 = base64.encoder.encode(peerIdBytes)

      try {
        fs.writeFileSync(peerIdFilename, peerIdB64)
      } catch (e) {
        console.error(e)
      }

      this.peerId = peerId
      return peerId
    }

    this.peerId = await createFromProtobuf(base64.decoder.decode(peerIdB64))
    return this.peerId
  }

  async init(datastore: MemoryDatastore = new MemoryDatastore()) {
    console.log('Starting libp2p client')

    const peerId = await this.getPeerId()

    this.libp2p = await createLibp2p({
      peerId,
      addresses: {
        // accept TCP connections on any port
        listen: ['/ip4/127.0.0.1/tcp/0']
      },
      transports: [tcp()],
      connectionEncryption: [noise()],
      streamMuxers: [yamux()],
      peerDiscovery: [
        bootstrap({
          list: [
            '/ip4/127.0.0.1/tcp/0/p2p/12D3KooWNYYYUtuxvmH7gsvApKE6YoiqBWNgZ6x3BBpea3RP1jTv'
          ],
          timeout: 1000, // in ms,
          tagName: 'bootstrap',
          tagValue: 50,
          tagTTL: 120000 // in ms
        })
      ],
      services: {
        echo: echo(),
        pubsub: gossipsub({
          // neccessary to run a single peer
          allowPublishToZeroTopicPeers: true,
          emitSelf: true
        }),
        identify: identify(),
        auth: libp2pAuth(this.storage)
      },
      datastore
    });

    console.log('Peer ID: ', peerId.toString())

    return this.libp2p
  }

  async dial( addr: string | Multiaddr): Promise<boolean> {
        console.log(`Dialing peer at ${addr}`)
        const multiaddrs: Multiaddr[] = []
        if (typeof addr === 'string') {
          multiaddrs.push(multiaddr(addr))
        } else {
          multiaddrs.push(addr)
        }
        await this.libp2p?.dial(multiaddrs)
        
        return true
    }

  async close() {
    console.log('Closing libp2p')
    await this.libp2p?.stop()
  }
}

function getAccessController() {
  return OrbitDBAccessController({ write: ["*"] })
}

export class OrbitDbService {

  libp2pService: Libp2pService
  ipfs: Helia | null
  orbitDb: OrbitDB | null
  dir: string

  constructor(libp2pService: Libp2pService) {
    this.libp2pService = libp2pService
    this.ipfs = null
    this.orbitDb = null
    this.dir = `./.orbitdb/${libp2pService.peerName}`
  }

  async init(datastore: MemoryDatastore = new MemoryDatastore()) {
    console.log('Initializing OrbitDB')
    if (!this.libp2pService.libp2p) {
      throw new Error('Cannot initialize OrbitDB, libp2p instance required')
    }
    this.ipfs = await createHelia({ libp2p: this.libp2pService.libp2p, datastore })
    await this.ipfs.start()
    const keystore = await KeyStore({ path: path.join(this.dir, './keystore') })
    const identities = await Identities({ ipfs: this.ipfs, keystore })
    this.orbitDb = await createOrbitDB({ 
      id: (await this.libp2pService.getPeerId()).toString(), 
      ipfs: this.ipfs, 
      directory: this.dir,
      identities
    })
  }

  async createDb(dbName: string): Promise<Events> {
    if (!this.orbitDb) {
      throw new Error('Must call init before creating a DB')
    }
    // Seems like we can improve the type definitions
    return await this.orbitDb.open(
      dbName, 
      { 
        write: ['*'], 
        sync: true, 
        meta: {}, 
        AccessController: getAccessController() 
      }
    ) as unknown as Events
  }

  async close() {
    console.log('Closing OrbitDB')
    await this.orbitDb?.stop()
    await this.ipfs?.stop()
  }
}

interface Channel {
  name: string
  addr: string
}

export class MessageService extends EventEmitter {

  orbitDbService: OrbitDbService
  channelListDb: Events | null
  channelDbs: Record<string, Events>

  constructor(orbitDbService: OrbitDbService) {
    super()

    this.orbitDbService = orbitDbService
    this.channelListDb = null
    this.channelDbs = {}
  }

  async init() {
    if (this.orbitDbService.orbitDb == null) {
      await this.orbitDbService.init()
    }

    // Sharing the channelListDb address is necessary for other peers to connect
    // to it. Each DB get's a unique address if only passing in a name to
    // createDb. That's just how OrbitDB works because of immutable databases.
    // Alternatively, I think you can share the owner's OrbitDB identity and
    // create the database with the same access controller.
    const name = 'channels'
    console.log(`Initializing channel list DB with name '${name}'`);
    this.channelListDb = await this.orbitDbService.createDb(name);
    console.log(`Initialized channel list DB with address ${this.channelListDb.address}`)
    this.channelListDb.events.on('update', entry => {
      console.log(`Got new channel: ${JSON.stringify(entry.payload.value)}`)
      this.openChannel(entry.payload.value)
    })
    console.log(`Initializing known channel DBs`)
    for (const entry of await this.channelListDb.all()) {
      await this.openChannel(entry.value as Channel)
    }
  }

  async createChannel(channelName: string): Promise<Events> {
    if (!this.channelListDb) {
      throw new Error('Must call init before creating a channel')
    }

    if (channelName in this.channelDbs) {
      return this.channelDbs[channelName]
    }

    const db = await this.createChannelDb('channel/' + channelName)

    this.channelDbs[channelName] = db
    await this.channelListDb.add({ name: channelName, addr: db.address })

    return db
  }

  private async openChannel(channel: Channel) {
    if (channel.name in this.channelDbs) {
      return
    }

    this.channelDbs[channel.name] = await this.createChannelDb(channel.addr)
  }

  private async createChannelDb(nameOrAddr: string): Promise<Events> {
    const db = await this.orbitDbService.createDb(nameOrAddr)

    db.events.on('update', entry => this.emit('message', entry.payload.value))

    return db
  }

  async sendMessage(channelName: string, message: EncryptedAndSignedPayload) {
    if (channelName in this.channelDbs) {
      this.channelDbs[channelName].add(message)
    } else {
      throw new Error('Channel does not exist')
    }
  }

  async readMessages(channelName: string): Promise<EncryptedAndSignedPayload[]> {
    let db: Events
    if (channelName in this.channelDbs) {
      db = this.channelDbs[channelName]
    } else {
      throw new Error('Channel does not exist')
    }

    const messages = await db.all()
    return messages.map((message) => message.value as EncryptedAndSignedPayload)
  }

  async close() {
    console.log('Closing OrbitDB')
    await this.orbitDbService?.close()
  }
}

export class Networking {
  private _libp2p: Libp2pService
  private _orbitDb: OrbitDbService
  private _messages: MessageService

  private constructor(libp2p: Libp2pService, orbitDb: OrbitDbService, messages: MessageService) {
    this._libp2p = libp2p
    this._orbitDb = orbitDb
    this._messages = messages
  }

  public static async init(storage: LocalStorage): Promise<Networking> {
    const context = storage.getContext()
    if (context == null) {
      throw new Error(`Context hasn't been initialized!`)
    }

    const datastore = new MemoryDatastore()
    const libp2p = new Libp2pService(context.user.userId, storage)
    console.log(`Initializing new libp2p peer with ID ${await libp2p.getPeerId()}`)
    await libp2p.init(datastore)

    console.log(libp2p.peerName)

    const orbitDb = new OrbitDbService(libp2p)
    console.log(`Initializing new orbitdb service for peer ID ${await libp2p.getPeerId()}`)
    await orbitDb.init(datastore)

    const messages = new MessageService(orbitDb)
    console.log(`Initializing new message service for peer ID ${await libp2p.getPeerId()}`)
    await messages.init()

    return new Networking(libp2p, orbitDb, messages)
  }

  get libp2p(): Libp2pService {
    return this._libp2p
  }

  get orbitDb(): OrbitDbService {
    return this._orbitDb
  }

  get messages(): MessageService {
    return this._messages
  }
}

const main = async () => {
    const teamName = 'Test'
    const username1 = 'isla'
    const username2 = 'isntla'
    const peerId1 = 'peer1'
    const peerId2 = 'peer2'

    // Peer 1
    const storage1 = new LocalStorage()

    const { 
        context: founderContext,
        sigChain
    } = SigChain.create(teamName, username1)

    storage1.setContext(founderContext)
    storage1.setAuthContext({ ...founderContext, team: sigChain.team })
    storage1.setSigChain(sigChain)

    const peer1 = new Libp2pService(peerId1, storage1);
    await peer1.init();

    const { seed } = sigChain.invites.create()

    // const orbitDb1 = new OrbitDbService(peer1);
    // await orbitDb1.init();

    // const db1 = await orbitDb1.createDb('messages');

    // Peer 2
    const storage2 = new LocalStorage()
    const prospectiveUser = UserService.createFromInviteSeed(username2, seed)
    storage2.setContext(prospectiveUser.context)
    storage2.setAuthContext({
        ...prospectiveUser.context,
        invitationSeed: seed
    })
    const peer2 = new Libp2pService(peerId2, storage2);
    await peer2.init();

    // const orbitDb2 = new OrbitDbService(peer2);
    // await orbitDb2.init();

    // const db2 = await orbitDb1.createDb(db1.db?.address || '');

    // Test
    // db2.on('update', (entry) => { console.log('Peer2: Received: ', entry.payload.value); });
    for (let addr of peer2.libp2p?.getMultiaddrs() ?? []) {
     await peer1.libp2p?.dial(addr);
    }
    // console.log('Peer1: Adding entry');
    // await db1.db?.add("Hello world");

    // await db1.close();
    // await orbitDb1.close();
    // await peer1.close();
}

// main().then().catch(console.error)
