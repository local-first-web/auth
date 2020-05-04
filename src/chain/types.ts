import { Context } from '../context'
import { Base64, UnixTimestamp } from '../lib/types'

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
  type: string | number

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
