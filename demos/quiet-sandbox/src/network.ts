import { createLibp2p, type Libp2p } from 'libp2p'
import { bootstrap } from '@libp2p/bootstrap'
import { tcp } from '@libp2p/tcp'
import { echo } from '@libp2p/echo'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
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

//@ts-ignore
import RNG from 'rng'

import * as os from 'os'

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
  private events: QuietAuthEvents
  private joining: boolean = false

  constructor(storage: LocalStorage, components: Libp2pAuthComponents, events: QuietAuthEvents) {
    this.protocol = '/local-first-auth/1.0.0'
    this.components = components
    this.storage = storage
    this.authConnections = {}
    this.outboundStreamQueue = pushable<{ peerId: PeerId, connection: Connection }>({ objectMode: true })
    this.outboundStreams = {}
    this.inboundStreams = {}
    this.events = events

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
    authConnection.on('joined', (payload) => {
        const { team, user } = payload
        console.log(`${this.storage.getContext()!.user.userId}: Joined team ${team.teamName} (userid: ${user.userId})!`)
        if (this.storage.getSigChain() == null && !this.joining) {
            this.joining = true
            console.log(`${user.userId}: Creating SigChain for user with name ${user.userName} and team name ${team.teamName}`)
            const context = this.storage.getContext()!
            this.storage.setSigChain(SigChain.createFromTeam(team, context).sigChain)
            console.log(`${user.userId}: Updating auth context`)
            this.storage.setAuthContext({
                user: context.user,
                device: context.device,
                team
            })
            this.joining = false
            this.events.emit(EVENTS.INITIALIZED_CHAIN)
        }
    })

    const handleAuthConnErrors = (error: Auth.ConnectionErrorPayload) => {
      if (error.type === 'TIMEOUT') {
        this.events.emit(EVENTS.AUTH_TIMEOUT, peerId)
      } else {
        console.error(`Got this error while handling auth connection`, JSON.stringify(error))
      }
    }

    authConnection.on('localError', (error) => {
      handleAuthConnErrors(error)
    })

    authConnection.on('remoteError', (error) => {
      handleAuthConnErrors(error)
    })

    // authConnection.on('change', (summary) => {
    //   const context = this.storage.getContext()!

    //   // console.log(`${context.user.userId}: Update with summary ${JSON.stringify(summary)}!`)
    //   const summaryStates = summary.split(',')
    //   if (summaryStates.includes('synchronizing')) {
    //     // const sigChain = this.storage.getSigChain()!
    //     // console.log(JSON.stringify(sigChain.minifiedTeamGraph))
    //     console.log(`${context.user.userId}: Update with summary ${JSON.stringify(summary)}!`)
    //   }

    //   // const graph: Auth.TeamGraph = (sigChain.teamGraph as Auth.TeamGraph)
    //   // console.log(JSON.stringify(graph.links))
    // })

    authConnection.on('connected', () => {
      const team = this.storage.getSigChain()!.team
      const user = this.storage.getContext()!.user
      authConnection.emit('sync', { team, user })
    })

    // authConnection.on('change', state => console.log(`${this.storage.getContext()?.user.userName} Change:`, state))

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

const libp2pAuth = (storage: LocalStorage, events: QuietAuthEvents): ((components: Libp2pAuthComponents) => Libp2pAuth) => {
  return (components: Libp2pAuthComponents) => new Libp2pAuth(storage, components, events)
}

export class Libp2pService {

  peerName: string
  libp2p: Libp2p | null
  storage: LocalStorage
  peerId: RSAPeerId | Ed25519PeerId | Secp256k1PeerId | null
  events: QuietAuthEvents

  constructor(peerName: string, storage: LocalStorage, events: QuietAuthEvents) {
    this.peerName = peerName
    this.libp2p = null
    this.storage = storage
    this.peerId = null
    this.events = events
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
    const ipAddresses = getIpAddresses()
    const ipOfInterfaceInUse = ipAddresses[DEFAULT_NETWORK_INTERFACE][0]
    const baseAddress = `/ip4/${ipOfInterfaceInUse}/tcp/0`
    console.log(`Using network interface ${DEFAULT_NETWORK_INTERFACE} and base address ${baseAddress}`)

    const peerId = await this.getPeerId()

    this.libp2p = await createLibp2p({
      peerId,
      connectionManager: {
        minConnections: 5,
        dialTimeout: 120_000,
        autoDialConcurrency: 5,
        autoDialMaxQueueLength: 1000,
        maxDialQueueLength: 1000
      },
      addresses: {
        // accept TCP connections on any port
        listen: [baseAddress]
      },
      transports: [tcp()],
      connectionEncryption: [noise()],
      streamMuxers: [yamux()],
      peerDiscovery: [
        bootstrap({
          list: [
            `${baseAddress}/12D3KooWNYYYUtuxvmH7gsvApKE6YoiqBWNgZ6x3BBpea3RP1jTv`
          ],
          timeout: 2000, // in ms,
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
          emitSelf: true,
          doPX: true
        }),
        identify: identify(),
        auth: libp2pAuth(this.storage, this.events)
      },
      datastore
    });

    this.libp2p.addEventListener('connection:close', (event) => {
      console.warn(`${peerId}: Connection closing with ${event.detail.remotePeer}`)
    })

    this.libp2p.addEventListener('transport:close', (event) => {
      console.warn(`${peerId}: Transport closing`)
    })

    console.log('Peer ID: ', peerId.toString())

    this.events.on(EVENTS.AUTH_TIMEOUT, async (peerId: PeerId) => {
      console.warn(`Connection with ${peerId} experienced an auth timeout, redialing!`)
      try {

        console.warn(`LIBP2P STATUS: ${this.libp2p?.status}`)
        if (this.libp2p?.getPeers().includes(peerId)) {
          console.warn(`HANGING UP`)
          await this.libp2p?.hangUp(peerId)
        }
        console.warn(`DELETING FROM PEER STORE`)
        await this.libp2p?.peerStore.delete(peerId)
        console.warn(`DIALING`)
        await this.dial(new Set([peerId]))
      } catch (e) {
        console.error(`Error while redialing peer ${peerId}`, e)
      }
    })

    return this.libp2p
  }

  async hangUp(addrsOrPeerIds: (string | Multiaddr | PeerId)[]): Promise<boolean> {
    if (addrsOrPeerIds.length === 0) {
      console.warn('No peers found to hang up, skipping!')
      return false
    }

    console.log(`Hanging up on ${addrsOrPeerIds.length} peers`)
    for (const addrOrPeerId of addrsOrPeerIds) {
      console.log(`Hanging up on ${addrOrPeerId}`)
      const multiAddrOrPeerId = typeof addrOrPeerId === 'string' ? multiaddr(addrOrPeerId) : addrOrPeerId
      await this.libp2p!.hangUp(multiAddrOrPeerId)
    }

    return true
  }

  async hangUpOnAll(): Promise<boolean> {
    if (!this.libp2p || this.libp2p.getPeers().length === 0) {
      console.warn(`No peers to hang up on!`)
      return true
    }

    console.log(`Hanging up on all peers`)
    return this.hangUp(this.libp2p.getPeers())
  }

  async dial(addrsOrPeerIds: Set<(string | Multiaddr | PeerId)>): Promise<boolean> {
    const peerCount = addrsOrPeerIds.size
    if (peerCount === 0) {
      console.warn('No peers found to dial, skipping!')
      return false
    }

    console.log(`Dialing ${peerCount} peers`)
    let waitForSigChainLoad = this.storage.getSigChain() == null
    if (waitForSigChainLoad) {
      console.log(`Trying peers one at a time to ensure admittance only happens once!`)
    }

    let successful = 0
    let maxConnections = Math.min(5, peerCount)
    let connectedIndices: Set<number> = new Set()
    const addrsOrPeerIdsArr = Array.from(addrsOrPeerIds)
    console.log(`Connecting to ${maxConnections} peers`)
    while(connectedIndices.size < maxConnections) {
      const rng = new RNG.MT(randomInt(1000000))
      const index = rng.range(0, peerCount)
      if (connectedIndices.has(index)) {
        continue
      }

      const addrOrPeerId = addrsOrPeerIdsArr[index]
      console.log(`Attempting to connect to ${addrOrPeerId}`)
      const multiAddrOrPeerId = typeof addrOrPeerId === 'string' ? multiaddr(addrOrPeerId) : addrOrPeerId
      try {
        const connection = await this.libp2p?.dial(multiAddrOrPeerId)
        if (!connection || connection.status !== 'open') {
          console.warn(`Couldn't connect to ${addrOrPeerId}, trying next!`)
          continue
        }

        if (waitForSigChainLoad) {
          console.log(`Waiting for sigchain to load before connecting to new peers!`)
          this.events.on(EVENTS.INITIALIZED_CHAIN, () => {
            if (!waitForSigChainLoad) return
            console.log(`${addrOrPeerId} - Sigchain loaded, continuing with dial!`)
            waitForSigChainLoad = false
            this.events.emit(EVENTS.INITIALIZED_CHAIN)
          })

          const waitIntervalMs = 250
          const waitTimeMs = 90_000
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
        successful++
        connectedIndices.add(index)
      } catch (e) {
        console.warn(`Failed to make a connection with error`, e)
        await this.hangUp([multiAddrOrPeerId])
      }
      console.log(`Successful connections thus far: ${successful}`)
    }

    this.events.emit(EVENTS.DIAL_FINISHED)
    return successful > 0
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
    console.log('Closing OrbitDB')
    await this.orbitDb?.stop()
    await this.ipfs?.stop()
  }
}

export class SigChainService extends EventEmitter {
  orbitDbService: OrbitDbService
  chainDb: Events | null

  constructor(orbitDbService: OrbitDbService) {
    super()

    this.orbitDbService = orbitDbService
    this.chainDb = null
  }

  async init() {
    const name = 'chain'
    console.log(`Initializing chain DB with name ${name}`)
    this.chainDb = await this.orbitDbService.createDb(name)
    this.chainDb.events.on('update', entry => {
      console.log(`Got new chain`)
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
    console.log(JSON.stringify(initialUpdate))

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

export enum EVENTS {
  INITIALIZED_CHAIN = 'INITIALIZED_CHAIN',
  DIAL_FINISHED = 'DIAL_FINISHED',
  AUTH_TIMEOUT = 'AUTH_TIMEOUT'
}

export class QuietAuthEvents {
  private _events: EventEmitter

  constructor() {
    this._events = new EventEmitter()
  }

  public on(event: EVENTS, listener: (...args: any[]) => void) {
    this._events.on(event, listener)
  }

  public emit(event: EVENTS, ...args: any[]) {
    this._events.emit(event, ...args)
  }
}

export class Networking {
  private _libp2p: Libp2pService
  private _orbitDb: OrbitDbService
  private _messages: MessageService
  private _sigChain: SigChainService
  private _storage: LocalStorage
  private _events: QuietAuthEvents

  private constructor(libp2p: Libp2pService, orbitDb: OrbitDbService, messages: MessageService, sigChain: SigChainService, events: QuietAuthEvents) {
    this._libp2p = libp2p
    this._orbitDb = orbitDb
    this._messages = messages
    this._sigChain = sigChain
    this._storage = libp2p.storage
    this._events = events
  }

  public static async init(storage: LocalStorage): Promise<Networking> {
    const context = storage.getContext()
    if (context == null) {
      throw new Error(`Context hasn't been initialized!`)
    }

    const events = new QuietAuthEvents()

    const datastore = new MemoryDatastore()
    const libp2p = new Libp2pService(context.user.userId, storage, events)
    console.log(`Initializing new libp2p peer with ID ${await libp2p.getPeerId()}`)
    await libp2p.init(datastore)

    console.log(libp2p.peerName)

    const orbitDb = new OrbitDbService(libp2p)
    console.log(`Initializing new orbitdb service for peer ID ${await libp2p.getPeerId()}`)
    await orbitDb.init(datastore)

    const messages = new MessageService(orbitDb)
    console.log(`Initializing new message service for peer ID ${await libp2p.getPeerId()}`)
    await messages.init()

    const sigChain = new SigChainService(orbitDb)
    console.log(`Initializing new sigchain service for peer ID ${await libp2p.getPeerId()}`)
    await sigChain.init()

    return new Networking(libp2p, orbitDb, messages, sigChain, events)
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

    const peer1 = new Libp2pService(peerId1, storage1, new QuietAuthEvents());
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
    const peer2 = new Libp2pService(peerId2, storage2, new QuietAuthEvents());
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
