import { MemberContext } from '/context'
import { Base64, Hash, UnixTimestamp, ValidationResult } from '/util/types'

export const ROOT = 'ROOT'
export const MERGE = 'MERGE'

export type Validator = <T extends LinkBody>(
  currentLink: ChainLink<T>,
  chain: SignatureChain<T>
) => ValidationResult

export type ValidatorSet = {
  [key: string]: Validator
}

interface LinkBodyCommon {
  /** Payload of the action */
  payload: unknown
  /** Context in which this link was authored (user, device, client) */
  context: MemberContext
  /** Unix timestamp on device that created this link */
  timestamp: UnixTimestamp
}

export type RootLinkBody = LinkBodyCommon & {
  type: typeof ROOT
  prev: null
}

export type NonRootLinkBody = LinkBodyCommon & {
  /** Label identifying the type of action this link represents */
  type: unknown
  prev: Base64
}

/** The part of the link that is signed */
export type LinkBody = RootLinkBody | NonRootLinkBody

/** The full link, consisting of a body and a signature link */
export interface SignedLink<T extends LinkBody> {
  /** hash of this link */
  hash: Hash

  /** The part of the link that is signed & hashed */
  body: T

  /** The signature block (signature, name, and key) */
  signed: {
    /** NaCL-generated base64 signature of the link's body */
    signature: Base64
    /** The username (or ID or email) of the person signing the link */
    userName: string
    /** The public half of the key used to sign the link, in base64 encoding */
    key: Base64
  }
}

/** User-writable fields of a link (omits fields that are added automatically) */
export type PartialLinkBody<T extends LinkBody> = Pick<T, 'type' | 'payload'>

export type ChainLink<T extends LinkBody> = SignedLink<T> | RootLink | MergeLink

export type RootLink = SignedLink<RootLinkBody>

export type MergeLink = {
  type: typeof MERGE
  hash: Hash
  body: [Hash, Hash]
}

export type LinkMap<T extends LinkBody> = { [hash: string]: ChainLink<T> }

export interface SignatureChain<T extends LinkBody> {
  root: Hash
  head: Hash
  links: LinkMap<T>
}

// type guards

export const isMergeLink = (o: ChainLink<any>): o is MergeLink => 'type' in o && o.type === MERGE

export const isRootLink = (o: ChainLink<any>): o is RootLink =>
  !isMergeLink(o) && o.body.prev === null
