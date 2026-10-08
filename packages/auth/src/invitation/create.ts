import { type UnixTimestamp } from '@localfirst/crdx'
import { generateStarterKeys } from './generateStarterKeys.js'
import { deriveId } from './deriveId.js'
import { normalize } from './normalize.js'
import { type DeviceInvitation, type Invitation, type MemberInvitation } from './types.js'

export const IKEY_LENGTH = 16

export function create(params: MemberParams): MemberInvitation
export function create(params: DeviceParams): DeviceInvitation
/**
 * Returns an an invitation to publicly post on the team's signature chain. Inspired by Keybase's
 * Seitan Token v2 exchange protocol.
 *
 * The `kind` says whether this invitation admits a new member or a new device for an existing
 * member; a device invitation also has to name the member it's for, and the type of the params
 * won't let you provide one without the other.
 */
export function create(params: Params): Invitation {
  const seed = normalize(params.seed)

  // The ID of the invitation is derived from the seed
  const id = deriveId(seed)

  // The ephemeral public signature key will be used to verify Bob's proof of invitation
  const starterKeys = generateStarterKeys(seed)
  const { publicKey } = starterKeys.signature

  const {
    maxUses = 1, // By default an invitation can only be used once
    expiration = 0 as UnixTimestamp, // By default an invitation never expires
  } = params

  return params.kind === 'DEVICE'
    ? { kind: 'DEVICE', id, publicKey, expiration, maxUses, userId: params.userId }
    : { kind: 'MEMBER', id, publicKey, expiration, maxUses }
}

type CommonParams = {
  /** A randomly generated secret to be passed to Bob via a side channel */
  seed: string

  /** Time when the invitation expires. If 0, the invitation does not expire. */
  expiration?: UnixTimestamp

  /** Number of times the invitation can be used. If 0, the invitation can be used any number of times. By default, an invitation can only be used once. */
  maxUses?: number
}

type MemberParams = {
  kind: 'MEMBER'
} & CommonParams

type DeviceParams = {
  kind: 'DEVICE'

  /** The member the invited device will belong to. */
  userId: string
} & CommonParams

type Params = MemberParams | DeviceParams
