import { KeysetWithSecrets, PublicKeyset as Keyset } from 'keys'
import { Base64, SemVer, UnixTimestamp } from '/types'

/** A user and their full set of keys, including secrets. SHOULD NEVER LEAVE THE LOCAL USER'S DEVICE.  */
export interface UserWithSecrets {
  /** Username (or ID or email) */
  name: string
  /** The user's keys, including their secrets. */
  keys: KeysetWithSecrets
}

/** A user and their public keys.  */
export interface User {
  /** Username (or ID or email) */
  name: string
  /** The user's public keys */
  keys: Keyset
}

/** A hash-chained array of signed links */
export type SignatureChain = SignedLink[]

/** The full link, consisting of a body and a signature block */
export interface SignedLink {
  /** The part of the link that is signed */
  body: LinkBody

  /** The signature block (signature, name, and key) */
  signed: {
    /** NaCL-generated base64 signature of the link's body */
    signature: Base64
    /** The username (or ID or email) of the person signing the link */
    name: string
    /** The public half of the key used to sign the link, in base64 encoding */
    key: Base64
  }
}

/** The part of the link that is signed */
export interface LinkBody {
  /** Label identifying the type of action this link represents */
  type: string

  /** Payload of the action */
  payload: any

  /** Context in which this link was authored (user, device, client) */
  context: Context

  /** Unix timestamp on device that created this block */
  timestamp: UnixTimestamp

  /** Unix time after which this block should be ignored */
  expires?: UnixTimestamp

  /** hash of previous block */
  prev: Base64 | null

  /** index of this block within signature chain */
  index: number
}

/** User-writable fields of a link (omits fields that are added automatically) */
export type PartialLinkBody = Pick<LinkBody, 'type' | 'payload'>

// TODO: This belongs in the team module
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

// TODO: This belongs in the team module
export type Member = {
  name: string
  encryptionKey: Base64
  signingKey: Base64
  generation: number // increments when keys are rotated
}

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

export interface ContextWithSecrets {
  user: UserWithSecrets
  device: Device
  client: Client
}

export interface Context {
  user: User
  device: Device
  client: Client
}
