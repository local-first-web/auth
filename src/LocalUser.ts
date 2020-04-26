import { Base64Keypair, Base64 } from 'types'
import { asymmetric, symmetric, signatures } from './lib'

export interface Keyset {
  signature: Base64Keypair
  asymmetric: Base64Keypair
  symmetric: Base64
}

export interface LocalUserOptions {
  username: string
}

const STORAGE_KEY = 'TACO_KEY_STORAGE'

export class LocalUser {
  constructor(options: LocalUserOptions) {
    const { username } = options
    this.username = username

    this.keyset = this.loadKeyset() || this.generateNewKeyset()
    this.storeKeyset()
  }

  public username: string
  public keyset: Keyset

  private loadKeyset = (): Keyset | undefined => {
    const allKeysets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return allKeysets[this.username]
  }

  private storeKeyset = () => {
    const allKeysets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    allKeysets[this.username] = this.keyset
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
