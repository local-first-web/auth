import * as base64 from '@stablelib/base64'
import * as utf8 from '@stablelib/utf8'
import nacl from 'tweetnacl'
import { newNonce, nonceLength } from '../util/nonce'

export const asymmetric = {
  /**
   * @returns A key pair consisting of a public key and a secret key, encoded as base64 strings, to
   * use for asymmetric encryption and decryption. (Note that asymmetric encryption keys cannot be
   * used for signatures, and vice versa.)
   */
  keyPair: () => {
    const keys = nacl.box.keyPair()
    return {
      publicKey: base64.encode(keys.publicKey),
      secretKey: base64.encode(keys.secretKey),
    }
  },

  /**
   * Asymmetrically encrypts a string of text.
   * @param plaintext The plaintext to encrypt
   * @param recipientPublicKey The public key of the intended recipient
   * @param senderSecretKey The secret key of the sender
   * @returns The encrypted data, encoded as a base64 string. The first 24 characters are the nonce;
   * the rest of the string is the encrypted message.
   * @see asymmetric.decrypt
   */
  encrypt: (
    plaintext: string,
    recipientPublicKey: string,
    senderSecretKey: string
  ) => {
    const nonce = newNonce()
    const messageBytes = utf8.encode(plaintext)
    const encrypted = nacl.box(
      messageBytes,
      nonce,
      base64.decode(recipientPublicKey),
      base64.decode(senderSecretKey)
    )
    const cipherBytes = new Uint8Array(nonceLength + encrypted.length)
    // the first 24 characters are the nonce
    cipherBytes.set(nonce)
    // the rest is the message
    cipherBytes.set(encrypted, nonceLength)
    return base64.encode(cipherBytes)
  },

  /**
   * Asymmetrically decrypts a message encrypted by `asymmetric.encrypt`.
   * @param cipher The encrypted data, encoded as a base64 string (the first 24 characters are the nonce;
   * the rest of the string is the encrypted message)
   * @param senderPublicKey The public key of the sender
   * @param recipientSecretKey The secret key of the recipient
   * @returns The original plaintext
   * @see asymmetric.encrypt
   */
  decrypt: (
    cipher: string,
    senderPublicKey: string,
    recipientSecretKey: string
  ) => {
    const cipherBytes = base64.decode(cipher)
    // the first 24 characters are the nonce
    const nonce = cipherBytes.slice(0, nonceLength)
    // the rest is the message
    const message = cipherBytes.slice(nonceLength, cipher.length)
    const decrypted = nacl.box.open(
      message,
      nonce,
      base64.decode(senderPublicKey),
      base64.decode(recipientSecretKey)
    )
    if (!decrypted) throw new Error('Could not decrypt message')
    return utf8.decode(decrypted)
  },
}
