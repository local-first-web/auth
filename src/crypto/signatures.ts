import * as base64 from '@stablelib/base64'
import * as utf8 from '@stablelib/utf8'

import nacl from 'tweetnacl'

export const signatures = {
  /**
   * @returns A key pair consisting of a public key and a secret key, encoded as base64 strings, to
   * use for signing and verifying messages. (Note that signature keys cannot be used for asymmetric
   * encryption, and vice versa.)
   */
  keyPair: () => {
    const keys = nacl.sign.keyPair()
    return {
      publicKey: base64.encode(keys.publicKey),
      secretKey: base64.encode(keys.secretKey),
    }
  },

  /**
   * @param message The plaintext message to sign
   * @param secretKey The signer's secret key, encoded as a base64 string
   * @returns A signature, encoded as a base64 string
   */
  sign: (message: string, secretKey: string) =>
    base64.encode(
      nacl.sign.detached(
        utf8.encode(message), //
        base64.decode(secretKey)
      )
    ),

  /**
   * @param content The plaintext message to be verified
   * @param signature The signature provided along with the message, encoded as a base64 string
   * @param publicKey The signer's public key, encoded as a base64 string
   * @returns true if verification succeeds, false otherwise
   */
  verify: ({ content, signature, publicKey }: SignedMessage) =>
    nacl.sign.detached.verify(
      utf8.encode(content),
      base64.decode(signature),
      base64.decode(publicKey)
    ),
}

export type SignedMessage = {
  content: string
  signature: string
  publicKey: string
}
