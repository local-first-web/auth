import { MemoryDatastore } from 'datastore-core'

import { createQsbLogger } from '../utils/logger/logger.js'
import { LocalStorage } from './storage.js'
import { QuietAuthEvents } from './events.js'
import { Libp2pService } from './libp2p/libp2p.js'
import { OrbitDbService } from './orbitdb/orbitdb.js'
import { MessageService } from './orbitdb/messages.js'

export class Networking {
  private _libp2p: Libp2pService
  private _orbitDb: OrbitDbService
  private _messages: MessageService
  private _storage: LocalStorage
  private _events: QuietAuthEvents

  private constructor(
    libp2p: Libp2pService, 
    orbitDb: OrbitDbService, 
    messages: MessageService, 
    events: QuietAuthEvents
  ) {
    this._libp2p = libp2p
    this._orbitDb = orbitDb
    this._messages = messages
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

    return new Networking(libp2p, orbitDb, messages, quietEvents)
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

  get storage(): LocalStorage {
    return this._storage
  }
  
  get events(): QuietAuthEvents {
    return this._events
  }
}
