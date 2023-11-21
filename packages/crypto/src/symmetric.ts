import sodium from 'libsodium-wrappers-sumo'
import { pack, unpack } from 'msgpackr'
import { stretch } from './stretch.js'
import type { Cipher, Base58, Payload } from './types.js'
import { base58, keyToBytes } from './util/index.js'

/**
 * Symmetrically encrypts a byte array.
 */
const encryptBytes = (
  /** The byte array to encrypt */
  payload: Uint8Array,
  /** The password used to encrypt */
  password: string
): Uint8Array => {
  const key = stretch(password)
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const encrypted = sodium.crypto_secretbox_easy(payload, nonce, key)
  const cipher: Cipher = { nonce, message: encrypted }
  const cipherBytes = pack(cipher)
  return cipherBytes
}

/**
 * Symmetrically decrypts a message encrypted by `symmetric.encryptBytes`. Returns the original byte array.
 */
const decryptBytes = (
  /** The encrypted data in msgpack format */
  cipher: Uint8Array,
  /** The password used to encrypt */
  password: string
): Uint8Array => {
  const key = stretch(password)
  const { nonce, message } = unpack(cipher) as Cipher
  return sodium.crypto_secretbox_open_easy(message, nonce, key)
}

/**
 * Symmetrically encrypts a string or object. Returns the encrypted data, encoded in msgpack format
 * as a base58 string.
 */
const encrypt = (
  /** The plaintext or object to encrypt */
  payload: Payload,
  /** The password used to encrypt */
  password: string
): Base58 => {
  const messageBytes = pack(payload)
  const cipherBytes = encryptBytes(messageBytes, password)
  const cipher = base58.encode(cipherBytes)
  return cipher
}

/**
 * Symmetrically decrypts a message encrypted by `symmetric.encrypt`.
 */
const decrypt = (
  /** The encrypted data in msgpack format, base58-encoded */
  cipher: Base58,
  /** The password used to encrypt */
  password: string
): Payload => {
  const cipherBytes = keyToBytes(cipher)
  const decrypted = decryptBytes(cipherBytes, password)
  return unpack(decrypted)
}

export const symmetric = { encryptBytes, decryptBytes, encrypt, decrypt }
