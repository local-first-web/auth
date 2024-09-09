import { type Events } from '@orbitdb/core'
import { EventEmitter } from 'events'
import * as Auth from '@localfirst/auth'
import { SigChain } from '../../auth/chain.js'
import { LoadedSigChain } from '../../auth/types.js'

import { createQsbLogger, QuietLogger } from '../../utils/logger/logger.js'
import { LocalStorage } from '../storage.js'
import { OrbitDbService } from './orbitdb.js'

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