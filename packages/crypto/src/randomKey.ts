import sodium from 'libsodium-wrappers-sumo'
import { base58 } from './util/index.js'

/** Returns an unpredictable key with the given length (32 bytes by default), as a byte array. */
export const randomKeyBytes = (length = 32) => sodium.randombytes_buf(length)

/** Returns an unpredictable key with the given length (32 bytes by default), asa a base58-encoded string. */
export const randomKey = (length = 32) => base58.encode(randomKeyBytes(length))
