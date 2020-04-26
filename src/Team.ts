import { EventEmitter } from 'events'
import { SignatureChain, TeamOptions, TacoOptions } from 'types'

export const initialize = (options: TacoOptions) => {}

export const create = (options: TeamOptions) => {
  return new Team(options)
}

export const load = (json: any, options: TeamOptions) => {
  return new Team({
    ...options,
    source: json,
  })
}

export class Team extends EventEmitter {
  constructor(options: TeamOptions) {
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
