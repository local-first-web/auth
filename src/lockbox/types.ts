import { Key, Base64 } from '/lib'

export interface Lockbox {
  /**  e.g. team, role, user */
  scope: string

  /** the public half of the sender's asymmetric encryption keys */
  senderPublicKey: Key

  /** the recipient's username */
  recipient: string

  /** the public half of the recipient's asymmetric encryption keys */
  recipientPublicKey: Key

  /** the secret, encrypted using `asymmetric.encrypt` */
  encryptedSecret: Base64
}
