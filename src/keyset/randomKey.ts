import { base64, randomKey as _randomKey } from '@herbcaudill/crypto'

/**
 * Returns a cryptographically random 32-byte secret key, as a base64-encoded string.
 * @param length (optional) length in bytes of the string to return. Defaults to 32.
 * @example
 * ```js
 *  const seed = randomKey() // qI7WZR+BGTAJD30JJRqRCVOLWL7iGxIHlbBmq80bjLg=
 * ```
 */
export const randomKey = (length: number = 32) => _randomKey(length, base64.encode)
