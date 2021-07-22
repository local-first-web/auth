import { Base58, Base58Keypair } from '@herbcaudill/crypto'

export interface Keyset {
  secretKey: Base58 // for symmetric encryption
  encryption: Base58Keypair // for asymmetric encryption
  signature: Base58Keypair
}

/**
 * Represents the scope of a keyset. Could be:
 * - an entire team: `{type: TEAM, name: TEAM}`
 * - a specific role: `{type: ROLE, name: 'admin'}`
 * - a specific member: `{type: MEMBER, name: 'alice'}`
 * - a specific device: `{type: DEVICE, name: 'alice laptop'}`
 * - a single-use keyset: `{type: EPHEMERAL, name: EPHEMERAL}`
 */
export interface KeyScope {
  type: KeyType
  name: string
}

export enum KeyType {
  TEAM = 'TEAM',
  ROLE = 'ROLE',
  MEMBER = 'MEMBER',
  DEVICE = 'DEVICE',
  EPHEMERAL = 'EPHEMERAL',
}

export interface KeyMetadata extends KeyScope {
  generation: number
}

export interface KeysetWithSecrets extends KeyMetadata, Keyset {}

export interface PublicKeyset extends KeyMetadata {
  encryption: Base58 // = encryption.publicKey
  signature: Base58 // = signature.publicKey
}

// type guard: PublicKeyset vs KeysetWithSecrets
export const hasSecrets = (keys: PublicKeyset | KeysetWithSecrets): keys is KeysetWithSecrets =>
  keys.encryption.hasOwnProperty('secretKey') &&
  keys.signature.hasOwnProperty('secretKey') &&
  'secretKey' in keys

// type guard: KeysetWithSecrets vs. KeyScope
export const isKeyset = (k: KeysetWithSecrets | KeyScope): k is KeysetWithSecrets =>
  'secretKey' in k && //
  'encryption' in k &&
  'signature' in k
