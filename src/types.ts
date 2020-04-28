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

  // context
  device?: Device
  user: string
  client?: Client

  // public keys
  encryption_key?: Base64
  signing_key: Base64

  // the generation increments every time keys are rotated
  generation: number

  // hash of previous block
  // TODO hmac? key?
  prev: Base64 | null

  // Unix timestamp on device that created this block
  timestamp: UnixTimestamp

  // Unix time when this block should be automatically revoked
  expires?: UnixTimestamp

  // index of this block within signature chain
  index: number
}

export const linkType = {
  root: 1,
  invite: 2,
  add_member: 3,
  add_device: 4,
  add_role: 5,
  change_membership: 6,
  revoke: 7,
  rotate: 8,
}

export type LinkType = ValueOf<typeof linkType>

export const deviceType = {
  desktop: 1,
  laptop: 2,
  tablet: 3,
  mobile: 4,
  bot: 5,
  server: 6,
  other: 99,
}
export type DeviceType = ValueOf<typeof linkType>

export interface Device {
  id: Base64
  name: string
  type: DeviceType
}

export interface Client {
  name: string
  version: SemVer
}

export type UnixTimestamp = number
export type Utf8 = string
export type Base64 = string
export type SemVer = string
export type Key = Utf8 | Uint8Array
export type Message = Base64 | Uint8Array | object

export type Base64Keypair = {
  publicKey: Base64
  secretKey: Base64
}

export type ValueOf<Obj> = Obj[keyof Obj]
