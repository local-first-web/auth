import { symmetric } from '@herbcaudill/crypto'
import { generateEphemeralKeys } from '/invitation/generateEphemeralKeys'
import { deriveId } from '/invitation/deriveId'
import { normalize } from '/invitation/normalize'
import { Invitation, InvitationBody } from '/invitation/types'
import { KeysetWithSecrets } from '/keyset'
import * as lockboxes from '/lockbox'

export const IKEY_LENGTH = 16

// A loosely adapted implementation of Keybase's Seitan Token v2 exchange protocol.

/**
 * Returns an an invitation to publicly post on the team's signature chain.
 * @param teamKeys The global team keys (Alice obtains these from the appropriate lockbox)
 * @param userName The user to invite
 * @param roles The roles to add the new user to
 * @param secretKey A randomly generated secret to be passed to Bob via a side channel
 */
export const create = ({
  invitationSeed,
  userName,
  roles = [],
  teamKeys,
}: {
  invitationSeed: string
  userName: string
  roles?: string[]
  teamKeys: KeysetWithSecrets
}): Invitation => {
  invitationSeed = normalize(invitationSeed)!
  const ephemeralKeys = generateEphemeralKeys(userName, invitationSeed)

  // Using the team-wide keys, encrypt Bob's username and roles so that we don't leak that
  // information in the public signature chain. We also include the ephemeral public signature key,
  // which will be used to verify Bob's proof of invitation.

  const invitationBody: InvitationBody = {
    userName,
    roles,
    publicKey: ephemeralKeys.signature.publicKey,
  }
  const encryptedBody = symmetric.encrypt(invitationBody, teamKeys.secretKey)

  // We put it all together to create the invitation.
  return {
    id: deriveId(invitationSeed, userName),
    encryptedBody,
    generation: teamKeys.generation,
    used: false,
    revoked: false,
  }
}
