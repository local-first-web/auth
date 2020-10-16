import * as base64 from '@stablelib/base64'
import * as utf8 from '@stablelib/utf8'
import msgpack from 'msgpack-lite'
import nacl from 'tweetnacl'
import { newNonce } from '/crypto/nonce'
import { stretch } from '/crypto/stretch'
import { Encrypted, Key, keyToBytes, Payload, payloadToBytes, Serialized } from '/util'

// These are straightforward implementations of NaCl crypto functions, accepting and returning
// base64 strings rather than byte arrays. The symmetric `encrypt` and `decrypt` functions can take
// passwords instead of 32-byte keys; the password is expanded using the
// [scrypt](https://en.wikipedia.org/wiki/Scrypt) algorithm.

// TODO probably want to embed the key generation # into the cipher

export const symmetric = {
  /**
   * Symmetrically encrypts a string of text (or utf8-encoded byte array).
   * @param payload The plaintext (or utf8-encoded byte array) to encrypt
   * @param password The password to use as a seed for an encryption key
   * @returns The encrypted data, in msgpack format
   * @see symmetric.decrypt
   */
  encrypt: <T extends Payload = Payload>(payload: Payload, password: Key): Encrypted<T> => {
    const key = stretch(password)
    const nonce = newNonce()
    const messageBytes = payloadToBytes(payload)
    const encrypted = nacl.secretbox(messageBytes, nonce, key)

    const cipherBytes = msgpack.encode({ nonce, message: encrypted })

    return base64.encode(cipherBytes)
  },

  /**
   * Symmetrically decrypts a message encrypted by `symmetric.encrypt`.
   * @param cipher The encrypted data in msgpack format
   * @param password The password used as a seed for an encryption key
   * @returns The original plaintext
   * @see symmetric.encrypt
   */
  decrypt: <T extends Payload = Payload>(cipher: Encrypted<T>, password: Key): Serialized<T> => {
    const key = stretch(password)
    const cipherBytes = keyToBytes(cipher)

    const { nonce, message } = msgpack.decode(cipherBytes)

    const decrypted = nacl.secretbox.open(message, nonce, key)
    if (!decrypted) throw new Error('Could not decrypt message')
    return utf8.decode(decrypted)
  },
}
