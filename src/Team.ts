import { EventEmitter } from 'events'
import { signatures } from './lib'
import { LocalUser } from './LocalUser'
import { LinkBody, linkType, SignatureChain } from './types'

export class Team extends EventEmitter {
  constructor(options: TeamOptions) {
    super()
    const { name, user, source, secureStorage } = options

    this.name = name
    this.user = new LocalUser({ name: user, secureStorage })
    this.signatureChain = []

    if (!source) this.create()
    else this.load(source)
  }

  public name: string
  public user: LocalUser
  public signatureChain: SignatureChain

  private create() {
    const { publicKey, secretKey } = this.user.keys.signature
    const body: LinkBody = {
      type: linkType.root,
      // TODO: device
      user: this.user.name,
      encryption_key: this.user.keys.asymmetric.publicKey,
      signing_key: publicKey,
      generation: 0,
      prev: null,
      timestamp: new Date().getTime(),
      index: 0,
    }
    const signature = signatures.sign(body, secretKey)
    this.signatureChain.push({
      body,
      signed: {
        name: this.user.name,
        signature,
        key: publicKey,
      },
    })
  }

  private load(source: string | object) {
    console.log(source)
    // TODO
  }

  public members = {
    invite: () => {},
    accept: () => {},
    remove: () => {},
    list: () => {},
  }

  public roles = {
    create: () => {},
    addUser: () => {},
    removeUser: () => {},
    check: () => {},
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

export interface TeamOptions {
  name: string
  user: string
  secureStorage?: any // TODO
  source?: string | object // JSON or instantiated object
}
