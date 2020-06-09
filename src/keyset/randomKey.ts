import nacl from 'tweetnacl'
import { base64 } from '/lib'

/**
 * Returns a cryptographically random 32-byte secret key, as a base64-encoded string.
 * @param size (optional) length in bytes of the string to return. Defaults to 32.
 * @example
 * ```js
 *  const seed = randomKey() // qI7WZR+BGTAJD30JJRqRCVOLWL7iGxIHlbBmq80bjLg=
 * ```
 */
export const randomKey = (size: number = 32) => base64.encode(nacl.randomBytes(size))
