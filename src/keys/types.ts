import { Base64, Base64Keypair } from '/lib'

export enum KeysetScope {
  TEAM = 'TEAM',
  ROLE = 'ROLE',
  MEMBER = 'MEMBER',
  DEVICE = 'DEVICE',
  EPHEMERAL = 'EPHEMERAL',
}

export type KeyMetadata = {
  scope: KeysetScope
  name: string
  generation: number
}

export type KeysetWithSecrets = KeyMetadata & {
  signature: Base64Keypair
  encryption: Base64Keypair
}

export type PublicKeyset = KeyMetadata & {
  signature: Base64 // = signature.publicKey
  encryption: Base64 // = encryption.publicKey
}

export type KeysetHistory = KeysetWithSecrets[]

export const hasSecrets = (keys: PublicKeyset | KeysetWithSecrets): keys is KeysetWithSecrets => {
  return keys.encryption.hasOwnProperty('secretKey') || keys.signature.hasOwnProperty('secretKey')
}
