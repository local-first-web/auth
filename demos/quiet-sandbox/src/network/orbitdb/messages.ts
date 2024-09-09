import { type Events } from '@orbitdb/core'
import { EventEmitter } from 'events'
import { EncryptedAndSignedPayload } from '../../auth/services/crypto/types.js'

import { createQsbLogger, QuietLogger } from '../../utils/logger/logger.js'
import { OrbitDbService } from './orbitdb.js'


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