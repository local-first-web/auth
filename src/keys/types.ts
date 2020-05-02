import { Base64Keypair, Base64 } from '../types'

export interface KeysetWithSecrets {
  signature: Base64Keypair
  asymmetric: Base64Keypair
  symmetric: { key: Base64 }
  generation?: number
}

export interface PublicKeyset {
  signature: Base64
  encryption: Base64
  generation?: number
}
