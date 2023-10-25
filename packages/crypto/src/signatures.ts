import sodium from "libsodium-wrappers-sumo"
import { pack } from "msgpackr"
import { stretch } from "./stretch.js"
import { type Base58, type Payload, type SignedMessage } from "./types.js"
import { base58, keypairToBase58, keyToBytes } from "./util/index.js"

/**
 * @returns A key pair consisting of a public key and a secret key, encoded as base58 strings, to
 * use for signing and verifying messages. (Note that signature keys cannot be used for asymmetric
 * encryption, and vice versa.)
 */
const keyPair = (seed?: string) => {
  const keypair = seed
    ? sodium.crypto_sign_seed_keypair(stretch(seed))
    : sodium.crypto_sign_keypair()
  return keypairToBase58(keypair)
}

/**
 * @returns A signature, encoded as a base58 string
 */
const sign = (
  payload: Payload,
  /** The signer's secret key, encoded as a base58 string */
  secretKey: Base58
) => {
  const payloadBytes = pack(payload)
  const secretKeyBytes = keyToBytes(secretKey)
  const signatureBytes = sodium.crypto_sign_detached(
    payloadBytes,
    secretKeyBytes
  )
  return base58.encode(signatureBytes)
}

/**
 * @returns true if verification succeeds, false otherwise
 */
const verify = ({ payload, signature, publicKey }: SignedMessage): boolean => {
  const payloadBytes = pack(payload)
  const signatureBytes = keyToBytes(signature)
  const publicKeyBytes = keyToBytes(publicKey)
  return sodium.crypto_sign_verify_detached(
    signatureBytes,
    payloadBytes,
    publicKeyBytes
  )
}

export const signatures = { keyPair, sign, verify }
