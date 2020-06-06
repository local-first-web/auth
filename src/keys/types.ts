import { Base64, Base64Keypair } from '/lib'

export enum KeyType {
  TEAM = 'TEAM',
  ROLE = 'ROLE',
  MEMBER = 'MEMBER',
  DEVICE = 'DEVICE',
  EPHEMERAL = 'EPHEMERAL',
}

export interface Keyset {
  encryption: Base64Keypair
  signature: Base64Keypair
}

/**
 * A KeyNode represents the
 */
export interface KeyScope {
  type: KeyType
  name: string
}

export interface KeyMetadata extends KeyScope {
  generation: number
}

export interface KeysWithSecrets extends KeyMetadata, Keyset {}

export interface PublicKeys extends KeyMetadata {
  encryption: Base64 // = encryption.publicKey
  signature: Base64 // = signature.publicKey
}

export type KeysetHistory = KeysWithSecrets[]

// type guard: PublicKeys vs KeysWithSecrets
export const hasSecrets = (keys: PublicKeys | KeysWithSecrets): keys is KeysWithSecrets =>
  keys.encryption.hasOwnProperty('secretKey') || keys.signature.hasOwnProperty('secretKey')
