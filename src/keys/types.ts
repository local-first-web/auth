import { Base64Keypair, Base64 } from '../types'

export interface Keyset {
  signature: Base64Keypair
  asymmetric: Base64Keypair
  symmetric: { key: Base64 }
  generation?: number
}
