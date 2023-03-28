import { base58 } from './base58'

export const keypairToBase58 = (keypair: KeyPair) => ({
  publicKey: base58.encode(keypair.publicKey),
  secretKey: base58.encode(keypair.privateKey),
})

export interface KeyPair {
  privateKey: Uint8Array
  publicKey: Uint8Array
}
