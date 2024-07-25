import { createLibp2p, type Libp2p } from 'libp2p'
import { bootstrap } from '@libp2p/bootstrap'
import { tcp } from '@libp2p/tcp'
import { echo } from '@libp2p/echo'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { createEd25519PeerId, createFromProtobuf, exportToProtobuf } from '@libp2p/peer-id-factory'
import { base64 } from 'multiformats/bases/base64'
import { createHelia, type Helia } from 'helia'
import { createOrbitDB, type Events, type KeyValue, OrbitDB, type LogEntry } from '@orbitdb/core'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
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
  Stream
} from '@libp2p/interface'
import type { ConnectionManager, IncomingStreamData, Registrar } from '@libp2p/interface-internal'
import { pipe } from 'it-pipe'
import { encode, decode } from 'it-length-prefixed'
import { pushable, type Pushable } from 'it-pushable'
import type { Uint8ArrayList } from 'uint8arraylist'
import map from 'it-map'

class LocalStorage {
  private authContext: Auth.Context | null

  constructor() {
    this.authContext = null
  }

  public setAuthContext(context: Auth.Context) {
    this.authContext = context
  }

  public getAuthContext(): Auth.Context | null {
    return this.authContext
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
      console.log('Joined', team, user)
    })
    authConnection.on('change', state => console.log('Change', state))

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

class Libp2pService {

  peerName: string
  libp2p: Libp2p | null
  storage: LocalStorage

  constructor(peerName: string, storage: LocalStorage) {
    this.peerName = peerName
    this.libp2p = null
    this.storage = storage
  }

  /**
   * Get a persistent peer ID for a given name.
   */
  async getPeerId() {
    let peerIdFilename = '.peerId.' + this.peerName
    let peerIdB64

    try {
      peerIdB64 = fs.readFileSync(peerIdFilename, 'utf8')
    } catch (e) {
      console.error(e)
    }

    if (!peerIdB64) {
      console.log('Creating peer ID')
      const peerId = await createEd25519PeerId()
      const peerIdBytes = exportToProtobuf(peerId)
      peerIdB64 = base64.encoder.encode(peerIdBytes)
    }

    try {
      fs.writeFileSync(peerIdFilename, peerIdB64)
    } catch (e) {
      console.error(e)
    }

    return await createFromProtobuf(base64.decoder.decode(peerIdB64))
  }

  async init() {
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
            '/ip4/127.0.0.1/tcp/8088/p2p/12D3KooWNYYYUtuxvmH7gsvApKE6YoiqBWNgZ6x3BBpea3RP1jTv'
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
          allowPublishToZeroTopicPeers: true
        }),
        identify: identify(),
        auth: libp2pAuth(this.storage)
      }
    })

    console.log('Peer ID: ', peerId.toString())

    return this.libp2p
  }

  async close() {
    console.log('Closing libp2p')
    await this.libp2p?.stop()
  }
}

class OrbitDbService {

  libp2pService: Libp2pService
  ipfs: Helia | null
  orbitDb: OrbitDB | null

  constructor(libp2pService: Libp2pService) {
    this.libp2pService = libp2pService
    this.ipfs = null
    this.orbitDb = null
  }

  async init() {
    console.log('Initializing OrbitDB')
    if (!this.libp2pService.libp2p) {
      throw new Error('Cannot initialize OrbitDB, libp2p instance required')
    }
    this.ipfs = await createHelia({ libp2p: this.libp2pService.libp2p })
    this.orbitDb = await createOrbitDB({ ipfs: this.ipfs, directory: this.libp2pService.peerName })
  }

  async createDb(dbName: string): Promise<Events> {
    if (!this.orbitDb) {
      throw new Error('Must call init before creating a DB')
    }
    // Seems like we can improve the type definitions
    return await this.orbitDb.open(dbName) as unknown as Events
  }

  async close() {
    console.log('Closing OrbitDB')
    await this.orbitDb?.stop()
    await this.ipfs?.stop()
  }
}

interface Message {
  // TODO
}

interface Channel {
  name: string
  addr: string
}

class MessageService extends EventEmitter {

  orbitDbService: OrbitDbService
  channelListDb: Events | null
  channelDbs: Record<string, Events>

  constructor(orbitDbService: OrbitDbService) {
    super()

    this.orbitDbService = orbitDbService
    this.channelListDb = null
    this.channelDbs = {}
  }

  async init(channelListDbAddr?: string): Promise<string> {
    await this.orbitDbService.init()
    // Sharing the channelListDb address is necessary for other peers to connect
    // to it. Each DB get's a unique address if only passing in a name to
    // createDb. That's just how OrbitDB works because of immutable databases.
    // Alternatively, I think you can share the owner's OrbitDB identity and
    // create the database with the same access controller.
    this.channelListDb = await this.orbitDbService.createDb(channelListDbAddr ?? 'channels')
    this.channelListDb.events.on('update', entry => this.openChannel(entry.payload.value))

    for (const entry of await this.channelListDb.all()) {
      this.openChannel(entry.value as Channel)
    }
    return this.channelListDb.address
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
    await this.channelListDb.add({ name: 'channelName', addr: db.address })

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

  async sendMessage(channelName: string, message: Message) {
    if (channelName in this.channelDbs) {
      this.channelDbs[channelName].add(message)
    } else {
      throw new Error('Channel does not exist')
    }
  }

  async close() {
    console.log('Closing OrbitDB')
    await this.orbitDbService?.close()
  }
}

const main = async () => {
  // Peer 1
  const storage1 = new LocalStorage()

  const founderContext = {
    user: Auth.createUser('test1', 'test1'),
    device: Auth.createDevice('test1', 'laptop'),
  }
  const teamName = 'Test'
  const team = Auth.createTeam(teamName, founderContext)
  storage1.setAuthContext({ ...founderContext, team })
  const peer1 = new Libp2pService('peer1', storage1)
  await peer1.init()

  const { seed } = team.inviteMember()

  // const orbitDb1 = new OrbitDbService(peer1)
  // const messageSrv1 = new MessageService(orbitDb1)
  // const channelListAddr = await messageSrv1.init()

  // Peer 2
  const storage2 = new LocalStorage()
  storage2.setAuthContext({
    user: Auth.createUser('test2', 'test2'),
    device: Auth.createDevice('test2', 'laptop'),
    invitationSeed: seed
  })
  const peer2 = new Libp2pService('peer2', storage2)
  await peer2.init()

  // const orbitDb2 = new OrbitDbService(peer2)
  // const messageSrv2 = new MessageService(orbitDb2)
  // await messageSrv2.init(channelListAddr)

  // Test
  for (let addr of peer2.libp2p?.getMultiaddrs() ?? []) {
    await peer1.libp2p?.dial(addr)
  }
}

main().then().catch(console.error)
