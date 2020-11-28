import { symmetric } from '@herbcaudill/crypto'
import { deriveId } from '/invitation/deriveId'
import { normalize } from '/invitation/normalize'
import {
  DeviceInvitation,
  DeviceInvitationPayload,
  Invitation,
  InvitationBody,
  MemberInvitation,
  MemberInvitationPayload,
} from '/invitation/types'
import * as keysets from '/keyset'
import { KeysetWithSecrets, KeyType } from '/keyset'
import * as lockbox from '/lockbox'

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
export const create = ({
  teamKeys,
  type,
  payload,
  secretKey,
  keysForLockboxes = [],
}: CreateArgs) => {
  secretKey = normalize(secretKey)

  // ## Step 1b, 1c
  // Stretch the key and hash it to obtain an invitation ID (Keybase docs: `inviteID`)
  const id = deriveId(secretKey)

  // ## Step 1d
  // Generate an ephemeral keyset. This will be Bob's first-use keyset; as soon as he's admitted,
  // he'll provide keys of his own choosing (with private keys that nobody else knows, including the
  // person who invited him).

  // From this keyset, we'll include the public signature key in the invitation, so other team
  // members can verify Bob's proof of invitation. We'll also use the public encryption key to
  // create lockboxes for him.

  // Since this keyset is derived from the secret invitation key, Bob can generate it independently.
  // Besides using it to generate his proof, he'll also need it to open the lockboxes included in
  // the invitation.
  const scope = { type: KeyType.MEMBER, name: payload.userName }
  const firstUseKeys = keysets.redactKeys(keysets.create(scope, secretKey))

  // Create lockboxes containing the provided team and role keys, locked using the ephemeral keys
  const lockboxes = keysForLockboxes.map(keyset => lockbox.create(keyset, firstUseKeys))

  // ## Step 2a
  // Encrypt Bob's username and roles so that we don't leak that information in the public signature
  // chain. We also include the public half of the signature keyset, which will be used to verify
  // Bob's proof of invitation.
  const invitationBody = {
    type,
    payload,
    publicKey: firstUseKeys.signature,
    lockboxes,
  } as InvitationBody
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

export const inviteMember = ({
  teamKeys,
  userName,
  roles,
  secretKey,
  keysForLockboxes = [],
}: InviteMemberArgs) =>
  create({
    teamKeys,
    type: MEMBER,
    payload: { userName, roles },
    keysForLockboxes,
    secretKey,
  }) as MemberInvitation

export const inviteDevice = ({
  teamKeys,
  userName,
  deviceId,
  secretKey,
  keysForLockboxes = [],
}: InviteDeviceArgs) =>
  create({
    teamKeys,
    type: DEVICE,
    payload: { userName, deviceId },
    keysForLockboxes,
    secretKey,
  }) as DeviceInvitation

interface InviteArgs {
  teamKeys: KeysetWithSecrets
  keysForLockboxes?: KeysetWithSecrets[]
  secretKey: string
}

type CreateArgs = InviteArgs & Pick<InvitationBody, 'type' | 'payload'>

interface InviteMemberArgs extends MemberInvitationPayload, InviteArgs {}
interface InviteDeviceArgs extends DeviceInvitationPayload, InviteArgs {}
