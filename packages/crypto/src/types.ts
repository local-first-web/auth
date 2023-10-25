export type Utf8 = string & { _utf8: false }
export type Base58 = string & { _base58: false }
export type Hash = Base58 & { _hash: false }
export type Payload = string | Record<string, unknown> | any[]

export type ByteKeypair = {
  publicKey: Uint8Array
  secretKey: Uint8Array
}

export type Base58Keypair = {
  publicKey: Base58
  secretKey: Base58
}

export type SignedMessage = {
  /** The plaintext message to be verified */
  payload: Payload
  /** The signature for the message, encoded as a base58 string */
  signature: Base58
  /** The signer's public key, encoded as a base58 string */
  publicKey: Base58
}

export type EncryptParams = {
  /** The plaintext to encrypt */
  secret: Payload
  /** The public key of the intended recipient */
  recipientPublicKey: Base58
  /** The secret key of the sender (optional). If not provided, an ephemeral keypair will be generated, and the public key included as metadata. */
  senderSecretKey?: Base58
}

export type DecryptParams = {
  /** The encrypted data, encoded in msgpack format as a base58 string */
  cipher: Base58
  /** The public key of the sender (optional). If not provided, an ephemeral public key is assumed to be included in the cipher metadata. */
  senderPublicKey?: Base58
  /** The secret key of the recipient */
  recipientSecretKey: Base58
}

export type Cipher = {
  nonce: Uint8Array
  message: Uint8Array
}

export type Encoder = (b: Uint8Array) => string
