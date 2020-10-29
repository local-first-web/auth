import { MemberContext } from '/context'
import { Base64, Hash, UnixTimestamp, ValidationResult } from '/util/types'

/** The part of the link that is signed */
export interface NodeBody {
  /** Label identifying the type of action this link represents */
  type: 'ROOT' | unknown
  /** Payload of the action */
  payload: unknown
  /** Context in which this link was authored (user, device, client) */
  context: MemberContext
  /** Unix timestamp on device that created this link */
  timestamp: UnixTimestamp
  /** Unix time after which this link should be ignored */
  expires?: UnixTimestamp
  /** hash of previous link */
  prev: Base64 | null
}

/** The full link, consisting of a body and a signature link */
export interface SignedNode<T = NodeBody> {
  /** The part of the link that is signed & hashed */
  body: T
  /** hash of this link */
  hash: Hash

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
export type PartialNodeBody<T extends NodeBody = NodeBody> = Pick<T, 'type' | 'payload'>

export type Validator = (currentNode: SignedNode, prevNode?: SignedNode) => ValidationResult

export type ValidatorSet = {
  [key: string]: Validator
}

export interface SignatureGraph<T extends NodeBody = NodeBody> {
  root: Hash
  head: Hash
  nodes: Map<Hash, SignedNode<T> | MergeNode>
}

export type MergeNode = [Hash, Hash]
