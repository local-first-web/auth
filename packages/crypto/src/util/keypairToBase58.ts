import { base58 } from './base58.js'

export const keypairToBase58 = (keypair: KeyPair) => ({
  publicKey: base58.encode(keypair.publicKey),
  secretKey: base58.encode(keypair.privateKey),
})

export type KeyPair = {
  privateKey: Uint8Array
  publicKey: Uint8Array
}
