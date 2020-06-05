import { Base64, Base64Keypair } from '/lib'

export enum KeysetScope {
  TEAM = 'TEAM',
  ROLE = 'ROLE',
  MEMBER = 'MEMBER',
  DEVICE = 'DEVICE',
  EPHEMERAL = 'EPHEMERAL',
}

export interface KeyNode {
  scope: KeysetScope
  name: string
}

export interface KeyMetadata extends KeyNode {
  generation: number
}

export interface KeysetWithSecrets extends KeyMetadata {
  encryption: Base64Keypair
  signature: Base64Keypair
}

export interface PublicKeyset extends KeyMetadata {
  encryption: Base64 // = encryption.publicKey
  signature: Base64 // = signature.publicKey
}

export type KeysetHistory = KeysetWithSecrets[]

// type guard: PublicKeyset vs KeysetWithSecrets
export const hasSecrets = (keys: PublicKeyset | KeysetWithSecrets): keys is KeysetWithSecrets => {
  return keys.encryption.hasOwnProperty('secretKey') || keys.signature.hasOwnProperty('secretKey')
}
