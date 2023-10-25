import sodium from 'libsodium-wrappers-sumo'
import { base58 } from './util/index.js'

/** Returns an unpredictable key with the given length (32 bytes by default). */

export const randomKey = (length = 32) => base58.encode(sodium.randombytes_buf(length))
