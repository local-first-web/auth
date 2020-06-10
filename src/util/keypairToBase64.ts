import * as base64 from '@stablelib/base64'
import nacl from 'tweetnacl'

export const keypairToBase64 = (keypair: nacl.BoxKeyPair | nacl.SignKeyPair) => ({
  publicKey: base64.encode(keypair.publicKey),
  secretKey: base64.encode(keypair.secretKey),
})
