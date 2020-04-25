import { EventEmitter } from 'events'
import { SignatureChain, TacoOptions } from 'types'

export class Team extends EventEmitter {
  constructor(options: TacoOptions) {
    super()

    const { source, secureStorage } = options
    this.signatureChain = []

    if (!source) {
      // TODO create new
    } else {
      // TODO load from source
    }

    if (!secureStorage) {
      // TODO use `keytar`
    } else {
      // TODO use whatever is provided
    }
  }

  private signatureChain: SignatureChain

  public roles = {
    create: () => {},
    addUser: () => {},
    removeUser: () => {},
    check: () => {},
    remove: () => {},
    list: () => {},
  }

  public members = {
    invite: () => {},
    accept: () => {},
    remove: () => {},
    list: () => {},
  }

  public crypto = {
    asymmetric: {
      encrypt: () => {},
      decrypt: () => {},
    },

    symmetric: {
      encrypt: () => {},
      decrypt: () => {},
    },

    signature: {
      sign: () => {},
      verify: () => {},
    },
  }
}
