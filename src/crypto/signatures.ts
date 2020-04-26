import * as base64 from '@stablelib/base64'
import nacl from 'tweetnacl'
import { Key, Message } from 'types'
import { maybeBase64 } from 'util/maybeBase64'
import { maybeUtf8 } from 'util/maybeUtf8'
import { keypairToBase64 } from '../util/keypairToBase64'

export const signatures = {
  /**
   * @returns A key pair consisting of a public key and a secret key, encoded as base64 strings, to
   * use for signing and verifying messages. (Note that signature keys cannot be used for asymmetric
   * encryption, and vice versa.)
   */
  keyPair: () => keypairToBase64(nacl.sign.keyPair()),

  /**
   * @param message The plaintext message to sign
   * @param secretKey The signer's secret key, encoded as a base64 string
   * @returns A signature, encoded as a base64 string
   */
  sign: (message: Message, secretKey: Key) =>
    base64.encode(
      nacl.sign.detached(
        maybeUtf8(message), //
        maybeBase64(secretKey)
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
      maybeUtf8(content),
      maybeBase64(signature),
      maybeBase64(publicKey)
    ),
}

export type SignedMessage = {
  content: Message
  signature: Key
  publicKey: Key
}
