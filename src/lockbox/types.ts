import { Key, Base64 } from '/lib'

export interface Lockbox {
  /**  e.g. team, role, user */
  scope: string

  /** the public half of the asymmetric keys used to encrypt the lockbox */
  publicKey: Key

  /** the public half of the recipient's asymmetric encryption keys */
  recipientPublicKey: Key

  /** the recipient's username */
  recipient: string

  /** the secret, encrypted using `asymmetric.encrypt` */
  encryptedSecret: Base64
}
