import sodium from 'libsodium-wrappers-sumo'
import { base58 } from './util'

/** Returns an unpredictable key with the given length (32 bytes by default).*/

export const randomKey = (length: number = 32) => base58.encode(sodium.randombytes_buf(length))
