import { type Base58, type Base58Keypair } from '@localfirst/crypto'

export const KeyType = {
  GRAPH: 'GRAPH',
  USER: 'USER',
} as const
export type KeyType = (typeof KeyType)[keyof typeof KeyType]

/**
 * A KeyScope represents the scope of a keyset. For example:
 * - a user: `{type: USER, name: 'alice'}`
 * - a device: `{type: DEVICE, name: 'laptop'}`
 * - a role: `{type: ROLE, name: 'MANAGER'}`
 * - a single-use keyset: `{type: EPHEMERAL, name: EPHEMERAL}`
 */
export type KeyScope = {
  type: string // not restricted to KeyType because apps will have their own types
  name: string
}

export type KeyMetadata = KeyScope & {
  generation: number
}

/**
 * A Keyset contains one secret key for symmetric encryption, as well as two keypairs, for
 * asymmetric encryption and signatures, respectively.
 * */
export type KeysetWithSecrets = KeyMetadata & {
  secretKey: Base58 // for symmetric encryption
  encryption: Base58Keypair // for asymmetric encryption
  signature: Base58Keypair
}

/** A Keyset contains the public encryption and signature keys from a KeysetWithSecrets */
export type Keyset = KeyMetadata & {
  encryption: Base58 // = encryption.publicKey
  signature: Base58 // = signature.publicKey
}

/**
 * A Keyring is a dictionary of keysets (including secrets), indexed by the public part of the
 * asymmetric encryption key
 * */
export type Keyring = Record<string, KeysetWithSecrets>

// TYPE GUARDS

/** Keyset vs KeysetWithSecrets  */
export const hasSecrets = (keys: Keyset | KeysetWithSecrets): keys is KeysetWithSecrets =>
  keys.encryption.hasOwnProperty('secretKey') &&
  keys.signature.hasOwnProperty('secretKey') &&
  'secretKey' in keys

/** KeysetWithSecrets vs anything else */
export const isKeyset = (
  k: Record<string, unknown> | Array<Record<string, unknown>>
): k is KeysetWithSecrets =>
  k !== undefined && //
  'secretKey' in k &&
  'encryption' in k &&
  'signature' in k

/** Type guard: Keyring vs KeysetWithSecrets  */
export const isKeyring = (k: Keyring | KeysetWithSecrets | KeysetWithSecrets[]): k is Keyring =>
  !Array.isArray(k) && !isKeyset(k)
