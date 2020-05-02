import { KeysetWithSecrets } from '../keys'
import { asymmetric, signatures, symmetric } from '../lib'

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
  public keys: KeysetWithSecrets

  private loadKeyset = (): KeysetWithSecrets | undefined => {
    const allKeysets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return allKeysets[this.name]
  }

  private storeKeyset = () => {
    const allKeysets = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    allKeysets[this.name] = this.keys
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allKeysets))
  }

  private generateNewKeyset = (): KeysetWithSecrets => {
    return {
      generation: 0,
      signature: signatures.keyPair(),
      asymmetric: asymmetric.keyPair(),
      symmetric: { key: symmetric.key() },
    }
  }
}
