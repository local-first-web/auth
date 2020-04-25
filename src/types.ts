export interface TacoOptions {
  user: string
  source?: string | object // JSON or instantiated object
  secureStorage?: any // TODO
}

export type SignatureChain = SignatureBlock[]

export interface SignatureBlock {
  body: {
    type: SignatureBlockType

    // context
    device: Device
    user: string
    client?: Client

    // public keys
    encryption_key?: Base64
    signing_key: Base64

    // the generation increments every time keys are rotated
    generation: number

    // hash of previous block
    // TODO hmac? key?
    prev: Base64

    // Unix timestamp on device that created this block
    timestamp: UnixTimestamp

    // Unix time when this block should be automatically revoked
    expires?: UnixTimestamp

    // index of this block within signature chain
    index: number
  }

  // body signed with `signing_key`
  signature: Base64
}

export enum SignatureBlockType {
  root,
  invite,
  add_member,
  add_device,
  add_role,
  change_membership,
  revoke,
  rotate,
}

export enum DeviceType {
  desktop,
  laptop,
  tablet,
  mobile,
  other,
}

export interface Device {
  id: Base64
  type: DeviceType
}

export interface Client {
  name: string
  version: SemVer
}

type UnixTimestamp = number
type Base64 = string
type SemVer = string
