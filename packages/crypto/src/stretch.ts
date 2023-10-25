import process from "node:process"
import memoize from "fast-memoize"
import sodium from "libsodium-wrappers-sumo"
import { type Base58 } from "./types.js"
import { base58, keyToBytes } from "./util/index.js"

/** Derives a key from a low-entropy input, such as a password. Current version of libsodium
 * uses the Argon2id algorithm, although that may change in later versions. */

export const stretch = memoize((password: string) => {
  const passwordBytes = keyToBytes(
    password,
    base58.detect(password) ? "base58" : "utf8"
  )
  const salt = base58.decode("H5B4DLSXw5xwNYFdz1Wr6e" as Base58)
  if (passwordBytes.length >= 16) {
    return sodium.crypto_generichash(32, passwordBytes, salt)
  } // It's long enough -- just hash to expand it to 32 bytes

  // during testing we use stretch parameters that are faster, but consequently less secure
  const isProd = process.env.NODE_ENV === "production"
  const opsLimit = isProd
    ? sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE
    : sodium.crypto_pwhash_OPSLIMIT_MIN
  const memLimit = isProd
    ? sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE
    : sodium.crypto_pwhash_MEMLIMIT_MIN
  return sodium.crypto_pwhash(
    32,
    passwordBytes,
    salt,
    opsLimit,
    memLimit,
    sodium.crypto_pwhash_ALG_DEFAULT
  )
})
