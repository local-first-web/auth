import { createLibp2p, type Libp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { echo } from '@libp2p/echo'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { mdns } from '@libp2p/mdns'
import { createFromPrivKey, createFromProtobuf, exportToProtobuf } from '@libp2p/peer-id-factory'
import { base64 } from 'multiformats/bases/base64'
import { createHelia, type Helia } from 'helia'
import { createOrbitDB, Documents, type Events, Identities, KeyStore, OrbitDB, OrbitDBAccessController } from '@orbitdb/core'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { identify } from '@libp2p/identify'
import fs from 'fs'
import { EventEmitter } from 'events'
import * as Auth from '@localfirst/auth'
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
} from '@libp2p/interface'
import type { ConnectionManager, IncomingStreamData, Registrar } from '@libp2p/interface-internal'
import { pipe } from 'it-pipe'
import { encode, decode } from 'it-length-prefixed'
import { pushable, type Pushable } from 'it-pushable'
import type { Uint8ArrayList } from 'uint8arraylist'
import { SigChain } from './auth/chain.js'
import { UserService } from './auth/services/members/userService.js';
import { multiaddr, Multiaddr } from '@multiformats/multiaddr';
import { EncryptedAndSignedPayload } from './auth/services/crypto/types.js'
import { MemoryDatastore } from 'datastore-core'
import { generateKeyPairFromSeed } from '@libp2p/crypto/keys'
import path from 'path'
import { LoadedSigChain } from './auth/types.js'
import { sleep } from './utils/utils.js'
import { randomInt } from 'crypto'
import { peerIdFromString } from '@libp2p/peer-id'

//@ts-ignore
import RNG from 'rng'

import * as os from 'os'
import { createQsbLogger, createQuietLogger, QuietLogger } from './utils/logger/logger.js'
import { suffixLogger } from './utils/logger/libp2pLogger.js'

export type IPMap = {
  [interfaceName: string]: string[]
}

const DEFAULT_NETWORK_INTERFACE = 'en0'

/*
Shamelessly copied from https://stackoverflow.com/a/8440736
*/
export function getIpAddresses(): IPMap {
  const interfaces = os.networkInterfaces();
  const results: IPMap = {}; // Or just '{}', an empty object

  for (const name in interfaces) {
      for (const net of interfaces[name]!) {
          // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
          // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
          const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
          if (net.family === familyV4Value && !net.internal) {
              if (!results[name]) {
                  results[name] = [];
              }
              results[name].push(net.address);
          }
      }
  }

  return results
}

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

interface PushableStream {
  stream: Stream
  pushable: Pushable<Uint8Array | Uint8ArrayList>
}

enum JoinStatus {
  PENDING = 'PENDING',
  JOINING = 'JOINING',
  JOINED = 'JOINED'
}

const createLFALogger = createQuietLogger('localfirst')

// Implementing local-first-auth as a service just to get started. I think we
// likely want to integrate it in a custom Transport/Muxer.
class Libp2pAuth {
  private readonly protocol: string
  private readonly components: Libp2pAuthComponents
  private storage: LocalStorage
  private authConnections: Record<string, Auth.Connection>
  private outboundStreamQueue: Pushable<{ peerId: PeerId, connection: Connection }>
  private outboundStreams: Record<string, PushableStream>
  private inboundStreams: Record<string, Stream>
  private restartableAuthConnections: Map<number, Auth.Connection>
  private bufferedConnections: { peerId: PeerId, connection: Connection }[]
  private events: QuietAuthEvents
  private peerId: PeerId
  private joining: boolean = false
  private restartInterval: NodeJS.Timeout
  private unblockInterval: NodeJS.Timeout
  private joinStatus: JoinStatus
  private LOGGER: QuietLogger

  constructor(peerId: PeerId, storage: LocalStorage, components: Libp2pAuthComponents, events: QuietAuthEvents) {
    this.protocol = '/local-first-auth/1.0.0'
    this.peerId = peerId
    this.components = components
    this.storage = storage
    this.authConnections = {}
    this.restartableAuthConnections = new Map()
    this.outboundStreamQueue = pushable<{ peerId: PeerId, connection: Connection }>({ objectMode: true })
    this.outboundStreams = {}
    this.inboundStreams = {}
    this.bufferedConnections = []
    this.joinStatus = JoinStatus.PENDING
    this.events = events
    this.LOGGER = createQsbLogger(`libp2p:auth:${peerId}`)

    pipe(
      this.outboundStreamQueue,
      async (source) => {
        for await (const { peerId, connection } of source) {
          await this.openOutboundStream(peerId, connection)
        }
      }
    ).catch((e) => { this.LOGGER.error('Outbound stream queue error', e) })

    this.restartInterval = setInterval(this.restartStoppedConnections, 45_000, this.restartableAuthConnections, this.LOGGER);
    this.unblockInterval = setInterval(this.unblockConnections, 5_000, this.bufferedConnections, this.joinStatus, this.LOGGER)
  }

  private restartStoppedConnections(restartableAuthConnections: Map<number, Auth.Connection>, logger: QuietLogger) {
    logger.info(`Attempting to restart stopped auth connections`)
    for (const [ms, connection] of restartableAuthConnections.entries()) {
      if (ms >= Date.now()) {
        connection.start()
        restartableAuthConnections.delete(ms)
      }
    }
  }

  private async unblockConnections(conns: { peerId: PeerId, connection: Connection }[], status: JoinStatus, logger: QuietLogger) {
    if (status !== JoinStatus.JOINED) return

    logger.info(`Unblocking ${conns.length} connections now that we've joined the chain`)
    while(conns.length > 0) {
      const conn = conns.pop()
      if (conn != null) {
        await this.onPeerConnected(conn.peerId, conn.connection)
      }
    }
  }

  async start() {
    this.LOGGER.info('Auth service starting')

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

    this.LOGGER.info('Opening outbound stream for peer', peerId.toString())
    const outboundStream = await connection.newStream(this.protocol, {
      runOnTransientConnection: false,
      negotiateFully: true
    })
    const outboundPushable: Pushable<Uint8Array | Uint8ArrayList> = pushable()
    this.outboundStreams[peerId.toString()] = {
      stream: outboundStream,
      pushable: outboundPushable
    }

    pipe(
      outboundPushable,
      outboundStream
    ).catch((e: Error) => this.LOGGER.error(`Error opening outbound stream to ${peerId}`, e))

    if (connection.direction === 'outbound') {
      await this.openInboundStream(peerId, connection)
    }

    this.authConnections[peerId.toString()].start()
  }

  private async openInboundStream(peerId: PeerId, connection: Connection) {
    if (peerId.toString() in this.inboundStreams) {
      return
    }

    this.LOGGER.info('Opening new inbound stream for peer', peerId.toString())
    const inboundStream = await connection.newStream(this.protocol, {
      runOnTransientConnection: false,
      negotiateFully: true
    })

    this.handleIncomingMessages(peerId, inboundStream)
    this.inboundStreams[peerId.toString()] = inboundStream
  }

  private async onIncomingStream({ stream, connection }: IncomingStreamData) {
    const peerId = connection.remotePeer
    this.LOGGER.info(`Handling existing incoming stream ${peerId.toString()}`)

    const oldStream = this.inboundStreams[peerId.toString()]
    if (oldStream) {
      this.LOGGER.info(`Old inbound stream found!`)
      await this.closeInboundStream(peerId, true)
    }

    this.handleIncomingMessages(peerId, stream)

    this.inboundStreams[peerId.toString()] = stream
  }

  private handleIncomingMessages(peerId: PeerId, stream: Stream) {
    pipe(
      stream,
      (source) => decode(source),
      async (source) => {
        for await (const data of source) {
          try {
            if (!(peerId.toString() in this.authConnections)) {
              this.LOGGER.error(`No auth connection established for ${peerId.toString()}`)
            } else {
              this.authConnections[peerId.toString()].deliver(data.subarray())
            }
          } catch (e) {
            this.LOGGER.error(`Error while delivering message to ${peerId}`, e)
          }
        }
      }
    )
  }

  private sendMessage(peerId: PeerId, message: Uint8Array) {
    try {
      this.outboundStreams[peerId.toString()]?.pushable.push(
        // length-prefix encoded
        encode.single(message)
      )
    } catch (e) {
      this.LOGGER.error(`Error while sending auth message over stream to ${peerId.toString()}`, e)
    }
  }

  // NOTE: This is not awaited by the registrar
  private async onPeerConnected(peerId: PeerId, connection: Connection) {      
    if (this.joinStatus === JoinStatus.JOINING) {
      this.LOGGER.warn(`Connection to ${peerId.toString()} will be buffered due to a concurrent join`)
      this.bufferedConnections.push({ peerId, connection })
      return
    }

    if (this.joinStatus === JoinStatus.PENDING) {
      this.joinStatus = JoinStatus.JOINING
    }

    this.LOGGER.info(`Peer connected (direction = ${connection.direction})!`)

    // https://github.com/ChainSafe/js-libp2p-gossipsub/issues/398
    if (connection.status !== 'open') {
      this.LOGGER.warn(`The connection with ${peerId.toString()} was not in an open state!`)
      return
    }

    const context = this.storage.getAuthContext()
    this.LOGGER.info(`Context with ${peerId.toString()} is a member context?: ${(context as Auth.InviteeMemberContext).invitationSeed == null}`)
    if (!context) {
      throw new Error('Auth context required to connect to peer')
    }

    if (peerId.toString() in this.authConnections) {
      this.LOGGER.info(`A connection with ${peerId.toString()} was already available, skipping connection initialization!`)
      return
    }

    const authConnection = new Auth.Connection({
      context,
      sendMessage: (message: Uint8Array) => {
        this.sendMessage(peerId, message)
      },
      createLogger: createLFALogger
    })

    // TODO: Listen for updates to context and update context in storage
    authConnection.on('joined', (payload) => {
        const { team, user } = payload
        this.LOGGER.info(`${this.storage.getContext()!.user.userId}: Joined team ${team.teamName} (userid: ${user.userId})!`)
        if (this.storage.getSigChain() == null && !this.joining) {
            this.joining = true
            this.LOGGER.info(`${user.userId}: Creating SigChain for user with name ${user.userName} and team name ${team.teamName}`)
            const context = this.storage.getContext()!
            this.storage.setSigChain(SigChain.createFromTeam(team, context).sigChain)
            this.LOGGER.info(`${user.userId}: Updating auth context`)
            this.storage.setAuthContext({
                user: context.user,
                device: context.device,
                team
            })
            this.joining = false
        }
        if (this.joinStatus === JoinStatus.JOINING) {
          this.joinStatus = JoinStatus.JOINED
          this.unblockConnections(this.bufferedConnections, this.joinStatus, this.LOGGER)
        }
        this.events.emit(EVENTS.INITIALIZED_CHAIN)
    })

    const handleAuthConnErrors = (error: Auth.ConnectionErrorPayload, remoteUsername: string | undefined) => {
      this.LOGGER.error(`Got an error while handling auth connection with ${remoteUsername}`, JSON.stringify(error))
      if (error.type === 'TIMEOUT') {
        this.events.emit(EVENTS.AUTH_TIMEOUT, { peerId, remoteUsername })
      } else if (error.type === 'DEVICE_UNKNOWN') {
        this.events.emit(EVENTS.MISSING_DEVICE, { peerId, remoteUsername })
      }
    }

    authConnection.on('localError', (error) => {
      handleAuthConnErrors(error, authConnection._context.userName)
    })

    authConnection.on('remoteError', (error) => {
      handleAuthConnErrors(error, authConnection._context.userName)
    })

    authConnection.on('connected', () => {
      this.LOGGER.info(`LFA Connected!`)
      if (this.storage.getContext() != null) {
        this.LOGGER.debug(`Sending sync message because our chain is intialized`)
        const team = this.storage.getSigChain()!.team
        const user = this.storage.getContext()!.user
        authConnection.emit('sync', { team, user })
      }
    })

    authConnection.on('disconnected', (event) => {
      this.LOGGER.info(`LFA Disconnected!`, event)
      authConnection.stop()
      this.restartableAuthConnections.set(Date.now() + 30_000, authConnection)
    })

    this.authConnections[peerId.toString()] = authConnection

    this.outboundStreamQueue.push({ peerId, connection })
  }

  private async onPeerDisconnected(peerId: PeerId) {
    this.LOGGER.warn(`Disconnecting auth connection with peer ${peerId.toString()}`)
    await this.closeAuthConnection(peerId)
    
  }

  private async closeOutboundStream(peerId: PeerId, deleteRecord?: boolean) {
    this.LOGGER.warn(`Closing outbound stream with ${peerId.toString()}`)
    const outboundStream = this.outboundStreams[peerId.toString()]

    if (outboundStream == null) {
      this.LOGGER.warn(`Can't close outbound stream with ${peerId.toString()} as it doesn't exist`)
      return
    }

    await outboundStream.pushable.end().onEmpty()
    await outboundStream.stream.close().catch(e => {
      outboundStream.stream.abort(e)
    })

    if (deleteRecord) {
      delete this.outboundStreams[peerId.toString()]
    }
  }

  private async closeInboundStream(peerId: PeerId, deleteRecord?: boolean) {
    this.LOGGER.warn(`Closing inbound stream with ${peerId.toString()}`)
    const inboundStream = this.inboundStreams[peerId.toString()]

    if (inboundStream == null) {
      this.LOGGER.warn(`Can't close inbound stream with ${peerId.toString()} as it doesn't exist`)
      return
    }

    await inboundStream.close().catch(e => {
      inboundStream.abort(e)
    })

    if (deleteRecord) {
      delete this.inboundStreams[peerId.toString()]
    }
  }

  private async closeAuthConnection(peerId: PeerId) {
    this.LOGGER.warn(`Closing auth connection with ${peerId.toString()}`)
    const connection = this.authConnections[peerId.toString()]

    if (connection == null) {
      this.LOGGER.warn(`Can't close auth connection with ${peerId.toString()} as it doesn't exist`)
    } else {
      connection.stop()
      delete this.authConnections[peerId.toString()]
    }

    await this.closeOutboundStream(peerId, true)
    await this.closeInboundStream(peerId, true)
  }
}

const libp2pAuth = (peerId: PeerId, storage: LocalStorage, events: QuietAuthEvents): ((components: Libp2pAuthComponents) => Libp2pAuth) => {
  return (components: Libp2pAuthComponents) => new Libp2pAuth(peerId, storage, components, events)
}

export class Libp2pService {
  peerName: string
  libp2p: Libp2p | null
  storage: LocalStorage
  peerId: RSAPeerId | Ed25519PeerId | Secp256k1PeerId | null
  events: QuietAuthEvents
  private LOGGER: QuietLogger

  constructor(peerName: string, storage: LocalStorage, events: QuietAuthEvents) {
    this.peerName = peerName
    this.libp2p = null
    this.storage = storage
    this.peerId = null
    this.events = events
    this.LOGGER = createQsbLogger("libp2p")
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

    if (fs.existsSync(peerIdFilename)) {
      try {
        peerIdB64 = fs.readFileSync(peerIdFilename, 'utf8')
      } catch (e) {
        this.LOGGER.error(`Error reading peerId file ${peerIdFilename}`, e)
      }
    }

    if (!peerIdB64) {
      this.LOGGER.info('Creating peer ID')
      const keys: Auth.KeysetWithSecrets = this.storage.getContext()?.user!.keys
      
      const buf = Buffer.from(keys.encryption.secretKey)
      const priv = await generateKeyPairFromSeed("Ed25519", new Uint8Array(buf).subarray(0, 32))
      const peerId = await createFromPrivKey(priv)
      const peerIdBytes = exportToProtobuf(peerId)
      peerIdB64 = base64.encoder.encode(peerIdBytes)

      try {
        fs.writeFileSync(peerIdFilename, peerIdB64)
      } catch (e) {
        this.LOGGER.error(`Error writing peer ID to file ${peerIdFilename}`, e)
      }

      this.peerId = peerId
      return peerId
    }

    this.peerId = await createFromProtobuf(base64.decoder.decode(peerIdB64))
    return this.peerId
  }

  async init(datastore: MemoryDatastore = new MemoryDatastore()) {
    this.LOGGER.info('Creating libp2p client')
    const peerId = await this.getPeerId()
    this.LOGGER = createQsbLogger(`libp2p:${peerId}`)
    const ipAddresses = getIpAddresses()
    const ipOfInterfaceInUse = ipAddresses[DEFAULT_NETWORK_INTERFACE][0]
    const baseAddress = `/ip4/${ipOfInterfaceInUse}/tcp/0`
    this.LOGGER.info(`Using network interface ${DEFAULT_NETWORK_INTERFACE} and base address ${baseAddress}`)

    this.libp2p = await createLibp2p({
      peerId,
      logger: suffixLogger(peerId.toString()),
      connectionManager: {
        minConnections: 5,
        maxConnections: 20,
        dialTimeout: 60_000,
        autoDialConcurrency: 1,
        autoDialMaxQueueLength: 1000,
        maxDialQueueLength: 1000,
        inboundUpgradeTimeout: 45_000
      },
      addresses: {
        // accept TCP connections on any port
        listen: [baseAddress],
      },
      transports: [tcp({
      })],
      connectionEncryption: [noise()],
      streamMuxers: [yamux({
        maxInboundStreams: 3_000,
        maxOutboundStreams: 3_000
      })],
      peerDiscovery: [
        mdns({
          interval: 30_000,
          serviceTag: "mdns.peer-discovery",
          peerName: this.peerId?.toString()
        })
      ],
      services: {
        echo: echo(),
        pubsub: gossipsub({
          // neccessary to run a single peer
          allowPublishToZeroTopicPeers: true,
          debugName: peerId.toString(),
          fallbackToFloodsub: true,
          prunePeers: 1000,
          emitSelf: false,
          scoreThresholds: {
            "acceptPXThreshold": -1000,
            "gossipThreshold": -1000,
            "graylistThreshold": -1000,
            "opportunisticGraftThreshold": -1000,
            "publishThreshold": -1000
          },
          doPX: true
        }),
        identify: identify({
          timeout: 30_000
        }),
        auth: libp2pAuth(peerIdFromString(this.peerId!.toString()), this.storage, this.events)
      },
      datastore
    });

    this.libp2p.addEventListener('peer:connect', (event) => {
      this.LOGGER.info(`Connected to new peer`, event.detail)
    })

    this.libp2p.addEventListener('connection:close', (event) => {
      this.LOGGER.warn(`Connection closing with ${event.detail.remotePeer}`)
    })

    this.libp2p.addEventListener('transport:close', (event) => {
      this.LOGGER.warn(`Transport closing`)
    })

    this.libp2p.addEventListener('peer:discovery', (event) => {
      this.LOGGER.info('Discovered new peer: ', event.detail)
    })

    this.LOGGER.info('Peer ID: ', peerId.toString())

    const onAuthError = async (errorMessage: string, errorData: { peerId: PeerId, remoteUsername: string | undefined }) => {
      this.LOGGER.warn(errorMessage, errorData)
      // try {

      //   this.LOGGER.warn(`LIBP2P STATUS: ${this.libp2p?.status}`, errorData)
      //   if (this.libp2p?.getPeers().includes(errorData.peerId)) {
      //     this.LOGGER.warn(`HANGING UP`, errorData)
      //     await this.libp2p?.hangUp(errorData.peerId)
      //   }
      //   this.LOGGER.warn(`DELETING FROM PEER STORE`, errorData)
      //   await this.libp2p?.peerStore.delete(errorData.peerId)
      //   this.LOGGER.warn(`DIALING`, errorData)
      //   await this.dial(new Set([errorData.peerId]))
      // } catch (e) {
      //   this.LOGGER.error(`Error while redialing peer ${errorData.peerId}`, errorData, e)
      // }
    }

    this.events.on(EVENTS.AUTH_TIMEOUT, async (errorData: { peerId: PeerId, remoteUsername: string | undefined }) => {
      const errorMessage = `Connection experienced an auth timeout, restarting!`
      onAuthError(errorMessage, errorData)
    })

    this.events.on(EVENTS.MISSING_DEVICE, async (errorData: { peerId: PeerId, remoteUsername: string | undefined }) => {
      const errorMessage = `Connection with ${peerId} failed due to missing device, restarting!`
      onAuthError(errorMessage, errorData)
    })

    return this.libp2p
  }

  async hangUp(addrsOrPeerIds: (string | Multiaddr | PeerId)[]): Promise<boolean> {
    if (addrsOrPeerIds.length === 0) {
      this.LOGGER.warn('No peers found to hang up, skipping!')
      return false
    }

    this.LOGGER.info(`Hanging up on ${addrsOrPeerIds.length} peers`)
    for (const addrOrPeerId of addrsOrPeerIds) {
      this.LOGGER.info(`Hanging up on ${addrOrPeerId}`)
      const multiAddrOrPeerId = typeof addrOrPeerId === 'string' ? multiaddr(addrOrPeerId) : addrOrPeerId
      await this.libp2p!.hangUp(multiAddrOrPeerId)
    }

    return true
  }

  async hangUpOnAll(): Promise<boolean> {
    if (!this.libp2p || this.libp2p.getPeers().length === 0) {
      this.LOGGER.warn(`No peers to hang up on!`)
      return true
    }

    this.LOGGER.info(`Hanging up on all peers`)
    return this.hangUp(this.libp2p.getPeers())
  }

  async addPeersToPeerStore(
    addrsOrPeerIdsArr: (string | Multiaddr | PeerId)[], 
    attemptedPeers: Set<Multiaddr | PeerId>
  ) {
    this.LOGGER.info(`Adding ${addrsOrPeerIdsArr.length - attemptedPeers.size} peers to the peer store without manually dialing`)
    for (const addrOrPeerId of addrsOrPeerIdsArr) {
      const multiAddrOrPeerId = typeof addrOrPeerId === 'string' ? multiaddr(addrOrPeerId) : addrOrPeerId

      let remotePeerId: PeerId
      let remoteMultiaddrs: Multiaddr[] | undefined
      if ((multiAddrOrPeerId as Multiaddr).getPeerId) {
        remotePeerId = peerIdFromString((multiAddrOrPeerId as Multiaddr).getPeerId()!)
        remoteMultiaddrs = [multiAddrOrPeerId as Multiaddr]
      } else {
        remotePeerId = multiAddrOrPeerId as PeerId
      }

      if (attemptedPeers.has(multiAddrOrPeerId) && this.libp2p?.getPeers().includes(remotePeerId)) {
        continue
      }
      this.libp2p?.peerStore.save(remotePeerId, { multiaddrs: remoteMultiaddrs })
    }
  }

  async dial(addrsOrPeerIds: Set<(string | Multiaddr | PeerId)>) {
    const peerCount = addrsOrPeerIds.size
    if (peerCount === 0) {
      this.LOGGER.warn('No peers found to dial, skipping!')
      return false
    }

    this.LOGGER.info(`Dialing ${peerCount} peers`)
    let waitForSigChainLoad = this.storage.getSigChain() == null
    if (waitForSigChainLoad) {
      this.LOGGER.info(`Trying peers one at a time to ensure admittance only happens once!`)
    }

    const attemptedPeers: Set<Multiaddr | PeerId> = new Set()
    const addrsOrPeerIdsArr = Array.from(addrsOrPeerIds)
    while(waitForSigChainLoad) {
      const rng = new RNG.MT(randomInt(1000000))
      const index = rng.range(0, peerCount)

      const addrOrPeerId = addrsOrPeerIdsArr[index]
      this.LOGGER.info(`Attempting to connect to ${addrOrPeerId}`)
      const multiAddrOrPeerId = typeof addrOrPeerId === 'string' ? multiaddr(addrOrPeerId) : addrOrPeerId
      if (attemptedPeers.has(multiAddrOrPeerId)) {
        continue
      }

      try {
        const connection = await this.libp2p?.dial(multiAddrOrPeerId)
        if (!connection || connection.status !== 'open') {
          this.LOGGER.warn(`Couldn't connect to ${addrOrPeerId}, trying next!`)
          continue
        }

        if (waitForSigChainLoad) {
          this.LOGGER.info(`Waiting for sigchain to load before connecting to new peers!`)
          this.events.on(EVENTS.INITIALIZED_CHAIN, () => {
            if (!waitForSigChainLoad) return
            this.LOGGER.info(`${addrOrPeerId} - Sigchain loaded, continuing with dial!`)
            waitForSigChainLoad = false
            this.events.emit(EVENTS.INITIALIZED_CHAIN)
          })

          const waitIntervalMs = 250
          const waitTimeMs = 60_000
          const waitEndTimeMs = Date.now() + waitTimeMs
          while (waitForSigChainLoad && Date.now() < waitEndTimeMs) {
            process.stdout.write('.')
            await sleep(waitIntervalMs)
          }
          console.log('\n')
          if (waitForSigChainLoad) {
            throw new Error(`Failed to sync sig chain within ${waitTimeMs}ms timeout`)
          }
        }
        attemptedPeers.add(multiAddrOrPeerId)
      } catch (e) {
        this.LOGGER.error(`Failed to make a connection to ${multiAddrOrPeerId} with error`, e)
        attemptedPeers.add(multiAddrOrPeerId)
        await this.hangUp([multiAddrOrPeerId])
      }
    }

    await this.addPeersToPeerStore(addrsOrPeerIdsArr, attemptedPeers)
    this.events.emit(EVENTS.DIAL_FINISHED)
  }

  async close() {
    this.LOGGER.warn('Closing libp2p')
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
  private LOGGER: QuietLogger

  constructor(libp2pService: Libp2pService) {
    this.libp2pService = libp2pService
    this.ipfs = null
    this.orbitDb = null
    this.dir = `./.orbitdb/${libp2pService.peerName}`
    this.LOGGER = createQsbLogger(`orbitdb:${libp2pService.peerId}`)
  }

  async init(datastore: MemoryDatastore = new MemoryDatastore()) {
    this.LOGGER.info('Initializing OrbitDB')
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
        type: 'events',
        write: ['*'], 
        sync: true, 
        meta: {}, 
        AccessController: getAccessController() 
      }
    ) as Events
  }

  async createDocumentDb(dbName: string): Promise<Documents> {
    if (!this.orbitDb) {
      throw new Error('Must call init before creating a DB')
    }
    // Seems like we can improve the type definitions
    return await this.orbitDb.open(
      dbName, 
      { 
        type: 'documents',
        write: ['*'], 
        sync: true, 
        meta: {}, 
        AccessController: getAccessController() 
      }
    ) as Documents
  }

  async close() {
    this.LOGGER.warn('Closing OrbitDB')
    await this.orbitDb?.stop()
    await this.ipfs?.stop()
  }
}

export class SigChainService extends EventEmitter {
  orbitDbService: OrbitDbService
  chainDb: Events | null
  private LOGGER: QuietLogger

  constructor(orbitDbService: OrbitDbService) {
    super()

    this.orbitDbService = orbitDbService
    this.chainDb = null
    this.LOGGER = createQsbLogger(`orbitdb:sigchain:${orbitDbService.libp2pService.peerId}`)
  }

  async init() {
    const name = 'chain'
    this.LOGGER.info(`Initializing chain DB with name ${name}`)
    this.chainDb = await this.orbitDbService.createDb(name)
    this.chainDb.events.on('update', entry => {
      this.LOGGER.info(`Got new chain`)
    })
  }

  async writeInitialChain(sigChain: SigChain) {
    if (this.chainDb == null) {
      throw new Error(`Must run 'init' before writing to the chain DB`)
    }

    // const payload = {
    //   type: "INITIAL_CHAIN_LOAD",
    //   chain: sigChain.persist()
    // }
    // return this.chainDb.add(payload)
  }

  async loadChainFromDb(storage: LocalStorage, keys: Auth.Keyring): Promise<LoadedSigChain> {
    if (this.chainDb == null) {
      throw new Error(`Must run 'init' before reading from the chain DB`)
    }

    const updates = await this.chainDb.all()
    const initialUpdate = updates[0].value as { type: string; chain: Uint8Array }
    this.LOGGER.debug(JSON.stringify(initialUpdate))

    const loadedSigChain = SigChain.join(storage.getContext()!, initialUpdate.chain, keys)
    storage.setSigChain(loadedSigChain.sigChain)
    storage.setAuthContext({
      user: storage.getContext()!.user,
      device: storage.getContext()!.device,
      team: loadedSigChain.sigChain.team
    })

    return loadedSigChain
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
  private LOGGER: QuietLogger

  constructor(orbitDbService: OrbitDbService) {
    super()

    this.orbitDbService = orbitDbService
    this.channelListDb = null
    this.channelDbs = {}
    this.LOGGER = createQsbLogger(`orbitdb:messages:${orbitDbService.libp2pService.peerId}`)
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
    this.LOGGER.info(`Initializing channel list DB with name '${name}'`);
    this.channelListDb = await this.orbitDbService.createDb(name);
    this.LOGGER.info(`Initialized channel list DB with address ${this.channelListDb.address}`)
    this.channelListDb.events.on('update', entry => {
      this.LOGGER.info(`Got new channel: ${JSON.stringify(entry.payload.value)}`)
      this.openChannel(entry.payload.value)
    })
    this.LOGGER.info(`Initializing known channel DBs`)
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
    this.LOGGER.info('Closing OrbitDB')
    await this.orbitDbService?.close()
  }
}

export enum EVENTS {
  INITIALIZED_CHAIN = 'INITIALIZED_CHAIN',
  DIAL_FINISHED = 'DIAL_FINISHED',
  AUTH_TIMEOUT = 'AUTH_TIMEOUT',
  MISSING_DEVICE = 'MISSING_DEVICE'
}

export class QuietAuthEvents {
  private _events: EventEmitter
  private _LOGGER: QuietLogger

  constructor(identifier: string) {
    this._events = new EventEmitter()
    this._LOGGER = createQsbLogger(`quietAuthEvents:${identifier}`)
  }

  public emit(event: EVENTS, ...args: any[]) {
    this._LOGGER.debug(`emit ${event}`)
    this._events.emit(event, ...args)
  }

  public on(event: EVENTS, listener: (...args: any[]) => void) {
    this._events.on(
      event, 
      // this.appendLogToListener(event, listener)
      listener
    )
  }

  public once(event: EVENTS, listener: (...args: any[]) => void) {
    this._events.once(
      event, 
      // this.appendLogToListener(event, listener)
      listener
    )
  }

  private appendLogToListener<T extends Array<any>>(event: EVENTS, listener: (...args: T) => void): (...args: T) => void {
    return (...args: T) => {
      this._LOGGER.debug(`received ${event} message`)
      return listener(...args)
    }
  }
}

export class Networking {
  private _libp2p: Libp2pService
  private _orbitDb: OrbitDbService
  private _messages: MessageService
  private _sigChain: SigChainService
  private _storage: LocalStorage
  private _events: QuietAuthEvents

  private constructor(
    libp2p: Libp2pService, 
    orbitDb: OrbitDbService, 
    messages: MessageService, 
    sigChain: SigChainService, 
    events: QuietAuthEvents
  ) {
    this._libp2p = libp2p
    this._orbitDb = orbitDb
    this._messages = messages
    this._sigChain = sigChain
    this._storage = libp2p.storage
    this._events = events
  }

  public static async init(storage: LocalStorage, events?: QuietAuthEvents): Promise<Networking> {
    const context = storage.getContext()
    if (context == null) {
      throw new Error(`Context hasn't been initialized!`)
    }

    const quietEvents = events == null ? new QuietAuthEvents(context.user.userName) : events
    const datastore = new MemoryDatastore()

    const libp2p = new Libp2pService(context.user.userId, storage, quietEvents)
    const LOGGER = createQsbLogger(`networking:${await libp2p.getPeerId()}`)
    LOGGER.info(`Initializing new libp2p service`)
    await libp2p.init(datastore)

    const orbitDb = new OrbitDbService(libp2p)
    LOGGER.info(`Initializing new orbitdb service`)
    await orbitDb.init(datastore)

    const messages = new MessageService(orbitDb)
    LOGGER.info(`Initializing new message service`)
    await messages.init()

    const sigChain = new SigChainService(orbitDb)
    LOGGER.info(`Initializing new sigchain service`)
    await sigChain.init()

    return new Networking(libp2p, orbitDb, messages, sigChain, quietEvents)
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

  get sigChain(): SigChainService {
    return this._sigChain
  }

  get storage(): LocalStorage {
    return this._storage
  }
  
  get events(): QuietAuthEvents {
    return this._events
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

    const peer1 = new Libp2pService(peerId1, storage1, new QuietAuthEvents(username1));
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
    const peer2 = new Libp2pService(peerId2, storage2, new QuietAuthEvents(username2));
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
