import { createHelia, type Helia } from 'helia'
import { createOrbitDB, Documents, type Events, Identities, KeyStore, OrbitDB, OrbitDBAccessController } from '@orbitdb/core'
import { MemoryDatastore } from 'datastore-core'
import path from 'path'

import { createQsbLogger, QuietLogger } from '../../utils/logger/logger.js'
import { Libp2pService } from '../libp2p/libp2p.js'

export function getAccessController() {
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