import { createLibp2p, type Libp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { echo } from '@libp2p/echo'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { mdns } from '@libp2p/mdns'
import { createFromPrivKey, createFromProtobuf, exportToProtobuf } from '@libp2p/peer-id-factory'
import { base64 } from 'multiformats/bases/base64'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { identify } from '@libp2p/identify'
import fs from 'fs'
import * as Auth from '@localfirst/auth'
import type {
  PeerId,
  RSAPeerId,
  Ed25519PeerId,
  Secp256k1PeerId,
} from '@libp2p/interface'
import { MemoryDatastore } from 'datastore-core'
import { generateKeyPairFromSeed } from '@libp2p/crypto/keys'
import { peerIdFromString } from '@libp2p/peer-id'

import { createQsbLogger, QuietLogger } from '../../utils/logger/logger.js'
import { suffixLogger } from '../../utils/logger/libp2pLogger.js'
import { DEFAULT_NETWORK_INTERFACE, getIpAddresses } from '../utils.js'
import { LocalStorage } from '../storage.js'
import { EVENTS, QuietAuthEvents } from '../events.js'
import { libp2pAuth } from './auth.js'

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
        // ISLA: This is what needs to be added to Quiet to make it work Libp2p and LFA work together
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

    // ISLA: The auth errors need to be reworked
    const onAuthError = async (errorMessage: string, errorData: { peerId: PeerId, remoteUsername: string | undefined }) => {
      this.LOGGER.error(errorMessage, errorData)
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

  async close() {
    this.LOGGER.warn('Closing libp2p')
    await this.libp2p?.stop()
  }
}