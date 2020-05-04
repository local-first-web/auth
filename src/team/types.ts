import { Base64 } from '../lib/types'

export enum LinkType {
  ROOT,
  ADD_MEMBER,
  INVITE,
  ADD_DEVICE,
  ADD_ROLE,
  CHANGE_MEMBERSHIP,
  REVOKE,
  ROTATE,
}

export type Member = {
  name: string
  encryptionKey: Base64
  signingKey: Base64
  generation: number // increments when keys are rotated
}
