import { Keyset } from 'keys'
import { Base64, SemVer, UnixTimestamp } from '/types'

export interface LocalUser {
  name: string
  keys: Keyset
}

export type SignatureChain = SignedLink[]

export interface SignedLink {
  body: LinkBody
  signed: {
    signature: Base64
    name: string
    key: Base64
  }
}

export interface LinkBody {
  type: LinkType
  payload: any

  // context
  user: string
  device: Device
  client: Client

  // Unix time when this block should be automatically revoked
  expires?: UnixTimestamp

  timestamp: UnixTimestamp // Unix timestamp on device that created this block

  // hash of previous block
  prev: Base64 | null

  // index of this block within signature chain
  index: number
}

// LinkBody without fields that are added automatically
export type PartialLinkBody = Omit<LinkBody, 'timestamp' | 'prev' | 'index'>

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

// export interface RootLink extends LinkBodyBase {
//   type: LinkType.ROOT
//   payload: {
//     team: {
//       name: string
//       rootUser: Member
//     }
//   }
//   prev: null
//   index: 0
// }

export enum DeviceType {
  desktop,
  laptop,
  tablet,
  mobile,
  bot,
  server,
  other,
}

export interface Device {
  id?: Base64
  name: string
  type: DeviceType
}

export interface Client {
  name: string
  version: SemVer
}

export interface Context {
  localUser: LocalUser
  device: Device
  client: Client
}
