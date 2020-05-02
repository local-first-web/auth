import * as base64 from '@stablelib/base64'
import * as utf8 from '@stablelib/utf8'
import nacl from 'tweetnacl'
import { Key, Message } from 'types'
import { keypairToBase64 } from './keypairToBase64'
import { keyToBytes } from './keyToBytes'
import { newNonce, nonceLength } from './nonce'
import { payloadToBytes } from './payloadToBytes'

export const asymmetric = {
  /**
   * @returns A key pair consisting of a public key and a secret key, encoded as base64 strings, to
   * use for asymmetric encryption and decryption. (Note that asymmetric encryption keys cannot be
   * used for signatures, and vice versa.)
   */
  keyPair: () => keypairToBase64(nacl.box.keyPair()),

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
    plaintext: Message,
    recipientPublicKey: Key,
    senderSecretKey: Key
  ) => {
    const nonce = newNonce()
    const messageBytes = payloadToBytes(plaintext)
    const encrypted = nacl.box(
      messageBytes,
      nonce,
      keyToBytes(recipientPublicKey),
      keyToBytes(senderSecretKey)
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
  decrypt: (cipher: Key, senderPublicKey: Key, recipientSecretKey: Key) => {
    const cipherBytes = keyToBytes(cipher)

    // the first 24 characters are the nonce
    const nonce = cipherBytes.slice(0, nonceLength)
    // the rest is the message
    const message = cipherBytes.slice(nonceLength, cipher.length)
    const decrypted = nacl.box.open(
      message,
      nonce,
      keyToBytes(senderPublicKey),
      keyToBytes(recipientSecretKey)
    )
    if (!decrypted) throw new Error('Could not decrypt message')
    return utf8.decode(decrypted)
  },
}
