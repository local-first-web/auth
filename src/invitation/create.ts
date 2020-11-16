import { symmetric } from '@herbcaudill/crypto'
import { deriveId } from '/invitation/deriveId'
import { normalize } from '/invitation/normalize'
import {
  Invitation,
  InvitationBody,
  MemberInvitationPayload,
  DeviceInvitationPayload,
} from '/invitation/types'
import * as keyset from '/keyset'
import { EPHEMERAL_SCOPE, KeysetWithSecrets, KeyType } from '/keyset'

const { DEVICE, MEMBER } = KeyType

export const IKEY_LENGTH = 16

// A loosely adapted implementation of Keybase's Seitan Token v2 exchange protocol. Step numbers
// refer to this page: http://keybase.io/docs/teams/seitan_v2

/**
 * Returns an an invitation to public post on the team's signature chain.
 * @param teamKeys The global team keys (Alice obtains these from the appropriate lockbox)
 * @param type
 * @param payload
 * @param secretKey A randomly generated secret (Step 1a) to be passed to Bob via a side channel
 * @see newSecretKey
 */
export const create = ({ teamKeys, type, payload, secretKey }: InvitationArgsInternal) => {
  secretKey = normalize(secretKey)

  // ## Step 1b, 1c
  // Stretch the key and hash it to obtain an invitation ID (Keybase docs: `inviteID`)
  const id = deriveId(secretKey)

  // ## Step 1d
  // Generate a signing keypair for Bob to use to verify that he knows the secret key. This keypair
  // is also derived from the secret key, so Bob can generate it independently.
  const { publicKey } = keyset.create(EPHEMERAL_SCOPE, secretKey).signature

  // ## Step 2a
  // Encrypt Bob's username and roles so that we don't leak that information in the public signature
  // chain. We also include the public half of the signature keyset, which will be used to verify
  // Bob's proof of invitation.
  const invitationBody = { type, payload, publicKey } as InvitationBody
  const encryptedBody = symmetric.encrypt(invitationBody, teamKeys.secretKey)

  // ## Step 2b
  // We put it all together to create the invitation.
  const invitation: Invitation = {
    id,
    type,
    encryptedBody,
    generation: teamKeys.generation,
    used: false,
    revoked: false,
  }
  return invitation
}

export const inviteMember = ({ teamKeys, payload, secretKey }: MemberInvitationArgs): Invitation =>
  create({ teamKeys, type: MEMBER, payload, secretKey })

export const inviteDevice = ({ teamKeys, payload, secretKey }: DeviceInvitationArgs): Invitation =>
  create({ teamKeys, type: DEVICE, payload, secretKey })

interface MemberInvitationArgs {
  teamKeys: KeysetWithSecrets
  payload: MemberInvitationPayload
  secretKey: string
}

interface DeviceInvitationArgs {
  teamKeys: KeysetWithSecrets
  payload: DeviceInvitationPayload
  secretKey: string
}

interface InvitationArgsInternal {
  teamKeys: KeysetWithSecrets
  type: InvitationBody['type']
  payload: InvitationBody['payload']
  secretKey: string
}
