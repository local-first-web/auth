import { Base64Keypair, Base64 } from '../lib/types'

export interface KeysetWithSecrets {
  seed: Base64
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
