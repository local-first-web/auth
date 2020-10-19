import * as base64 from '@stablelib/base64'
import { decode as utf8Decode } from '@stablelib/utf8'
import msgpack from 'msgpack-lite'
import nacl from 'tweetnacl'
import { newNonce } from '/crypto/nonce'
import { Key, keypairToBase64, keyToBytes, Payload, payloadToBytes } from '/util'

interface EncryptParams {
  secret: Payload
  recipientPublicKey: Key
  senderSecretKey: Key
}

interface DecryptParams {
  cipher: Key
  senderPublicKey: Key
  recipientSecretKey: Key
}

export const asymmetric = {
  /**
   * @returns A key pair consisting of a public key and a secret key, encoded as base64 strings, to
   * use for asymmetric encryption and decryption. (Note that asymmetric encryption keys cannot be
   * used for signatures, and vice versa.)
   */
  keyPair: () => keypairToBase64(nacl.box.keyPair()),

  /**
   * Asymmetrically encrypts a string of text.
   * @param secret The plaintext to encrypt
   * @param recipientPublicKey The public key of the intended recipient
   * @param senderSecretKey The secret key of the sender
   * @returns The encrypted data, encoded in msgpack format as a base64 string
   * @see asymmetric.decrypt
   */
  encrypt: ({ secret, recipientPublicKey, senderSecretKey }: EncryptParams) => {
    const nonce = newNonce()
    const messageBytes = payloadToBytes(secret)
    const encrypted = nacl.box(
      messageBytes,
      nonce,
      keyToBytes(recipientPublicKey),
      keyToBytes(senderSecretKey)
    )
    const cipherBytes = msgpack.encode({ nonce, message: encrypted })

    return base64.encode(cipherBytes)
  },

  /**
   * Asymmetrically decrypts a message encrypted by `asymmetric.encrypt`.
   * @param cipher The encrypted data, encoded in msgpack format as a base64 string
   * @param senderPublicKey The public key of the sender
   * @param recipientSecretKey The secret key of the recipient
   * @returns The original plaintext
   * @see asymmetric.encrypt
   */
  decrypt: ({ cipher, senderPublicKey, recipientSecretKey }: DecryptParams) => {
    const cipherBytes = keyToBytes(cipher)

    const { nonce, message } = msgpack.decode(cipherBytes)
    const decrypted = nacl.box.open(
      message,
      nonce,
      keyToBytes(senderPublicKey),
      keyToBytes(recipientSecretKey)
    )
    if (!decrypted) throw new Error('Could not decrypt message')
    return utf8Decode(decrypted)
  },

  /**
   * Asymmetrically encrypts a string of text, using an ephemeral keypair for the sender rather than
   * the sender's own keys. The public half of the sender keys is included in the cipher.
   * @param secret The plaintext to encrypt
   * @param recipientPublicKey The public key of the intended recipient
   * @returns The encrypted data, encoded in msgpack format as a base64 string
   * @see asymmetric.decryptWithEphemeralKey
   */
  encryptWithEphemeralKey: ({
    secret,
    recipientPublicKey,
  }: {
    secret: Payload
    recipientPublicKey: Key
  }) => {
    const nonce = newNonce()
    const senderKeys = asymmetric.keyPair()
    const messageBytes = payloadToBytes(secret)
    const encrypted = nacl.box(
      messageBytes,
      nonce,
      keyToBytes(recipientPublicKey),
      keyToBytes(senderKeys.secretKey)
    )
    const cipherBytes = msgpack.encode({
      nonce,
      message: encrypted,
      senderPublicKey: senderKeys.publicKey,
    })

    return base64.encode(cipherBytes)
  },

  /**
   * Asymmetrically decrypts a message encrypted by `asymmetric.encryptWithEphemeralKey`. Looks for
   * the sender's public key in the cipher text rather than expecting it as a parameter.
   * @param cipher The encrypted data, encoded in msgpack format as a base64 string
   * @param recipientSecretKey The secret key of the recipient
   * @returns The original plaintext
   * @see asymmetric.encryptWithEphemeralKey
   */
  decryptWithEphemeralKey: ({
    cipher,
    recipientSecretKey,
  }: {
    cipher: Key
    recipientSecretKey: Key
  }) => {
    const cipherBytes = keyToBytes(cipher)

    const { nonce, message, senderPublicKey } = msgpack.decode(cipherBytes)
    const decrypted = nacl.box.open(
      message,
      nonce,
      keyToBytes(senderPublicKey),
      keyToBytes(recipientSecretKey)
    )
    if (!decrypted) throw new Error('Could not decrypt message')
    return utf8Decode(decrypted)
  },
}
