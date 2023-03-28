import sodium from 'libsodium-wrappers-sumo'
import { pack, unpack } from 'msgpackr'
import { DecryptParams, EncryptParams, Base58, Payload } from './types'
import { base58, keypairToBase58, keyToBytes } from './util'
import { stretch } from './stretch'

/**
 * Wrappers of selected libsodium crypto functions. Each of these functions accepts and returns
 * base58 strings rather than byte arrays.
 */

export const asymmetric = {
  /**
   * @returns A key pair consisting of a public key and a secret key, encoded as base58 strings, to
   * use for asymmetric encryption and decryption. (Note that asymmetric encryption keys cannot be
   * used for signatures, and vice versa.)
   */
  keyPair: (
    /** (optional) If provided, the the key pair will be derived from the secret key. */
    seed?: string
  ) => {
    const keypair = seed
      ? sodium.crypto_box_seed_keypair(stretch(seed))
      : sodium.crypto_box_keypair()
    return keypairToBase58(keypair)
  },

  /**
   * Asymmetrically encrypts a string or object.
   * @returns The encrypted data, encoded in msgpack format as a base58 string
   * @see asymmetric.decrypt
   */
  encrypt: ({ secret, recipientPublicKey, senderSecretKey }: EncryptParams): Base58 => {
    const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES)
    const messageBytes = pack(secret)

    let senderPublicKey: string | undefined
    if (senderSecretKey === undefined) {
      // use ephemeral sender keys
      const senderKeys = asymmetric.keyPair()
      senderSecretKey = senderKeys.secretKey
      senderPublicKey = senderKeys.publicKey
    } else {
      // use provided sender keys; no public key included in metadata
      senderPublicKey = undefined
    }

    // encrypt message
    const message = sodium.crypto_box_easy(
      messageBytes,
      nonce,
      keyToBytes(recipientPublicKey),
      keyToBytes(senderSecretKey)
    )
    const cipherBytes = pack({ nonce, message, senderPublicKey })
    return base58.encode(cipherBytes)
  },

  /**
   * Asymmetrically decrypts a message encrypted by `asymmetric.encrypt`.
   * @returns The original object or plaintext
   * @see asymmetric.encrypt
   */
  decrypt: ({ cipher, recipientSecretKey, senderPublicKey }: DecryptParams): Payload => {
    const cipherBytes = keyToBytes(cipher)
    const unpackedCipher = unpack(cipherBytes)
    const { nonce, message } = unpackedCipher

    // if sender public key is not included, assume an ephemeral public key is included in metadata
    senderPublicKey = senderPublicKey ?? unpackedCipher.senderPublicKey

    const decrypted = sodium.crypto_box_open_easy(
      message,
      nonce,
      keyToBytes(senderPublicKey!),
      keyToBytes(recipientSecretKey)
    )
    return unpack(decrypted)
  },
}
