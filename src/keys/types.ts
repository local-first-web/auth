import { Base64, Base64Keypair } from '/lib'

export enum KeysetScope {
  TEAM = 'TEAM',
  ROLE = 'ROLE',
  MEMBER = 'MEMBER',
  DEVICE = 'DEVICE',
  EPHEMERAL = 'EPHEMERAL',
}

export interface KeyMetadata {
  scope: KeysetScope /**  e.g. ROLE, MEMBER, DEVICE */
  name: string /**  e.g. 'admin', 'alice', 'dell-laptop' */
  generation: number /** generation index (0-based) - incremented each time this key is rotated */
}

export interface KeysetWithSecrets extends KeyMetadata {
  seed: Base64
  signature: Base64Keypair
  encryption: Base64Keypair
}

export interface PublicKeyset extends KeyMetadata {
  signature: Base64 // = signature.publicKey
  encryption: Base64 // = encryption.publicKey
}

export const hasSecrets = (keys: PublicKeyset | KeysetWithSecrets): keys is KeysetWithSecrets => {
  return keys.encryption.hasOwnProperty('secretKey') || keys.signature.hasOwnProperty('secretKey')
}
