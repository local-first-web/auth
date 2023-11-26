export type Utf8 = string & { _utf8: false }
export type Base58 = string & { _base58: false }
export type Hash = Base58 & { _hash: false }

export type Payload = any // msgpacker can serialize anything

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

export type Cipher = {
  nonce: Uint8Array
  message: Uint8Array
}

export type Encoder = (b: Uint8Array) => string
