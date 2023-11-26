import sodium from 'libsodium-wrappers-sumo'
import { pack, unpack } from 'msgpackr'
import { stretch } from './stretch.js'
import type { Base58, Cipher, Payload } from './types.js'
import { base58, keyToBytes, keypairToBase58 } from './util/index.js'

/**
 * @returns A key pair consisting of a public key and a secret key, encoded as base58 strings, to
 * use for asymmetric encryption and decryption. (Note that asymmetric encryption keys cannot be
 * used for signatures, and vice versa.)
 */
const keyPair = (
  /** (optional) If provided, the the key pair will be derived from the secret key. */
  seed?: string
) => {
  const keypair = seed ? sodium.crypto_box_seed_keypair(stretch(seed)) : sodium.crypto_box_keypair()
  return keypairToBase58(keypair)
}

const encryptBytes = ({
  secret,
  recipientPublicKey,
  senderSecretKey,
}: {
  /** The plaintext to encrypt */
  secret: Payload
  /** The public key of the intended recipient */
  recipientPublicKey: Base58
  /** The secret key of the sender (optional). If not provided, an ephemeral keypair will be generated, and the public key included as metadata. */
  senderSecretKey?: Base58
}): Uint8Array => {
  const secretBytes = pack(secret)
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES)

  let senderPublicKey: string | undefined
  if (senderSecretKey === undefined) {
    // Use ephemeral sender keys
    const senderKeys = asymmetric.keyPair()
    senderSecretKey = senderKeys.secretKey
    senderPublicKey = senderKeys.publicKey
  } else {
    // Use provided sender keys; no public key included in metadata
    senderPublicKey = undefined
  }

  // Encrypt message
  const message = sodium.crypto_box_easy(
    secretBytes,
    nonce,
    keyToBytes(recipientPublicKey),
    keyToBytes(senderSecretKey)
  )
  const cipherBytes = pack({ nonce, message, senderPublicKey })
  return cipherBytes
}

const decryptBytes = ({
  cipher,
  recipientSecretKey,
  senderPublicKey,
}: {
  /** The encrypted data, encoded in msgpack format */
  cipher: Uint8Array
  /** The public key of the sender (optional). If not provided, an ephemeral public key is assumed to be included in the cipher metadata. */
  senderPublicKey?: Base58
  /** The secret key of the recipient */
  recipientSecretKey: Base58
}): Payload => {
  const unpackedCipher = unpack(cipher) as Cipher & { senderPublicKey?: Base58 }
  const { nonce, message } = unpackedCipher

  // If sender public key is not included, assume an ephemeral public key is included in metadata
  senderPublicKey = senderPublicKey ?? unpackedCipher.senderPublicKey

  const decrypted = sodium.crypto_box_open_easy(
    message,
    nonce,
    keyToBytes(senderPublicKey!),
    keyToBytes(recipientSecretKey)
  )
  return unpack(decrypted)
}

/**
 * Asymmetrically encrypts a string or object.
 * @returns The encrypted data, encoded in msgpack format as a base58 string
 * @see asymmetric.decrypt
 */
const encrypt = ({
  secret,
  recipientPublicKey,
  senderSecretKey,
}: {
  /** The plaintext to encrypt */
  secret: Payload
  /** The public key of the intended recipient */
  recipientPublicKey: Base58
  /** The secret key of the sender (optional). If not provided, an ephemeral keypair will be generated, and the public key included as metadata. */
  senderSecretKey?: Base58
}): Base58 => {
  const cipherBytes = encryptBytes({ secret, recipientPublicKey, senderSecretKey })
  return base58.encode(cipherBytes)
}

/**
 * Asymmetrically decrypts a message encrypted by `asymmetric.encrypt`.
 * @returns The original object or plaintext
 * @see asymmetric.encrypt
 */
const decrypt = ({
  cipher,
  recipientSecretKey,
  senderPublicKey,
}: {
  /** The encrypted data, encoded in msgpack format as a base58 string */
  cipher: Base58
  /** The public key of the sender (optional). If not provided, an ephemeral public key is assumed to be included in the cipher metadata. */
  senderPublicKey?: Base58
  /** The secret key of the recipient */
  recipientSecretKey: Base58
}): Payload => {
  const cipherBytes = keyToBytes(cipher)
  return decryptBytes({ cipher: cipherBytes, recipientSecretKey, senderPublicKey })
}

export const asymmetric = {
  keyPair,
  encryptBytes,
  decryptBytes,
  encrypt,
  decrypt,
}
