import * as base64 from '@stablelib/base64'
import * as utf8 from '@stablelib/utf8'
import nacl from 'tweetnacl'
import { newNonce, nonceLength } from '../util/nonce'
import { stretch } from './stretch'

// These are straightforward implementations of NaCl crypto functions, accepting and returning
// base64 strings rather than byte arrays. The symmetric `encrypt` and `decrypt` functions can take
// passwords instead of 32-byte keys; the password is expanded using the
// [scrypt](https://en.wikipedia.org/wiki/Scrypt) algorithm.

export const symmetric = {
  /**
   * Symmetrically encrypts a string of text (or byte array).
   * @param message The plaintext (or byte array) to encrypt
   * @param password The password to use as a seed for an encryption key
   * @returns The encrypted data, encoded as a base64 string. The first 24 characters are the nonce;
   * the rest of the string is the encrypted message.
   * @see symmetric.decrypt
   */
  encrypt: (message: string | Uint8Array, password: string | Uint8Array) => {
    const key = stretch(password)
    const nonce = newNonce()
    const messageBytes =
      typeof message === 'string' ? utf8.encode(message) : message
    const box = nacl.secretbox(messageBytes, nonce, key)
    const cipherBytes = new Uint8Array(nonceLength + box.length)
    // the first 24 characters are the nonce
    cipherBytes.set(nonce)
    // the rest is the message
    cipherBytes.set(box, nonceLength)
    return base64.encode(cipherBytes)
  },

  /**
   * Symmetrically decrypts a message encrypted by `symmetric.encrypt`.
   * @param cipher The encrypted data, encoded as a base64 string (the first 24 characters are the nonce;
   * the rest of the string is the encrypted message)
   * @param password The password used as a seed for an encryption key
   * @returns The original plaintext
   * @see symmetric.encrypt
   */
  decrypt: (cipher: string | Uint8Array, password: string | Uint8Array) => {
    const key = stretch(password)
    const cipherBytes =
      typeof cipher === 'string'
        ? base64.decode(cipher)
        : (cipher as Uint8Array)
    // the first 24 characters are the nonce
    const nonce = cipherBytes.slice(0, nonceLength)
    // the rest is the message
    const message = cipherBytes.slice(nonceLength, cipher.length)
    const decrypted = nacl.secretbox.open(message, nonce, key)
    if (!decrypted) throw new Error('Could not decrypt message')
    return utf8.decode(decrypted)
  },
}
