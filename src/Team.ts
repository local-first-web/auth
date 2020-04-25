import { EventEmitter } from 'events'

export interface TacoOptions {
  user: string
  source?: string | object // JSON or instantiated object
  secureStorage?: any // TODO
}

export interface SignatureBlock {}

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

  private signatureChain: SignatureBlock[]

  public roles = {
    create: () => {},
    addUser: () => {},
  }

  public members = {
    invite: () => {},
    accept: () => {},
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
    signatures: {
      sign: () => {},
      verify: () => {},
    },
  }
}
