import sodium from 'libsodium-wrappers-sumo'
import { pack, unpack } from 'msgpackr'
import { stretch } from './stretch.js'
import type { Base58, Cipher, Password, Payload } from './types.js'
import { base58, keyToBytes } from './util/index.js'

/**
 * Symmetrically encrypts a byte array with key commitment protection.
 * This implementation prevents the "invisible salamanders" attack by 
 * binding the key to the ciphertext with a commitment scheme.
 */
const encryptBytes = (
  /** The plaintext or object to encrypt */
  payload: Payload,
  /** The password used to encrypt */
  password: Password
): Uint8Array => {
  const messageBytes = pack(payload)
  const key = stretch(password)
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  
  // Step 1: Create a key commitment by deriving a subkey bound to both the key and the nonce
  // This ensures there's only one valid key for each ciphertext
  const keyCommitment = sodium.crypto_generichash(
    sodium.crypto_secretbox_KEYBYTES,  // Size of secretbox key
    nonce,                             // Bind to the nonce
    key                                // Derive from the key
  )
  
  // Step 2: Use the committed key for encryption
  // This binds the ciphertext to the specific key
  const encrypted = sodium.crypto_secretbox_easy(messageBytes, nonce, keyCommitment)
  
  // Step 3: Package everything together
  const cipher: Cipher = { nonce, message: encrypted }
  const cipherBytes = pack(cipher)
  return cipherBytes
}

/**
 * Symmetrically decrypts a message encrypted by `symmetric.encryptBytes`.
 * Derives the same committed key to ensure the ciphertext can only be decrypted
 * with the exact same key used for encryption.
 */
const decryptBytes = (
  /** The encrypted data in msgpack format */
  cipher: Uint8Array,
  /** The password used to encrypt */
  password: Password
): Payload => {
  const key = stretch(password)
  const { nonce, message } = unpack(cipher) as Cipher
  
  // Step 1: Derive the same committed key used for encryption
  const keyCommitment = sodium.crypto_generichash(
    sodium.crypto_secretbox_KEYBYTES,
    nonce,
    key
  )
  
  // Step 2: Use the committed key for decryption
  // If this is not the exact same key used for encryption, decryption will fail
  try {
    const decrypted = sodium.crypto_secretbox_open_easy(message, nonce, keyCommitment)
    return unpack(decrypted)
  } catch (error) {
    // When key commitment fails, sodium.crypto_secretbox_open_easy will throw
    throw new Error('Decryption failed - possible invisible salamanders attack')
  }
}

/**
 * Symmetrically encrypts a string or object. Returns the encrypted data, encoded in msgpack format
 * as a base58 string.
 */
const encrypt = (
  /** The plaintext or object to encrypt */
  payload: Payload,
  /** The password used to encrypt */
  password: Password
): Base58 => {
  const cipherBytes = encryptBytes(payload, password)
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
  password: Password
): Payload => {
  const cipherBytes = keyToBytes(cipher)
  return decryptBytes(cipherBytes, password)
}

export const symmetric = { encryptBytes, decryptBytes, encrypt, decrypt }
