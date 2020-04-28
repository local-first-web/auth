import { Base64Keypair, Base64 } from 'types'
import { asymmetric, symmetric, signatures } from './lib'

export interface Keyset {
  signature: Base64Keypair
  asymmetric: Base64Keypair
  symmetric: Base64
}

export interface LocalUserOptions {
  name: string
  secureStorage?: any // TODO
}

const STORAGE_KEY = 'TACO_KEY_STORAGE'

export class LocalUser {
  constructor(options: LocalUserOptions) {
    const { name } = options
    this.name = name

    this.keys = this.loadKeyset() || this.generateNewKeyset()
    this.storeKeyset()
  }

  public name: string
  public keys: Keyset

  private loadKeyset = (): Keyset | undefined => {
    const allKeysets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return allKeysets[this.name]
  }

  private storeKeyset = () => {
    const allKeysets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    allKeysets[this.name] = this.keys
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allKeysets))
  }

  private generateNewKeyset = (): Keyset => {
    return {
      signature: signatures.keyPair(),
      asymmetric: asymmetric.keyPair(),
      symmetric: symmetric.key(),
    }
  }
}
