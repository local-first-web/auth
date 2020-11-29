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
 * @param userName
 * @param roles
 * @param userKeys
 * @param secretKey A randomly generated secret to be passed to Bob via a side channel
 */
export const invite = ({
  secretKey,
  userName,
  newUserKeys,
  roles = [],
  teamKeys,
}: {
  secretKey: string
  userName: string
  newUserKeys?: KeysetWithSecrets
  roles?: string[]
  teamKeys: KeysetWithSecrets
}): Invitation => {
  secretKey = normalize(secretKey)!
  const ephemeralKeys = generateEphemeralKeys(userName, secretKey)

  // Using the team-wide keys, encrypt Bob's username and roles so that we don't leak that
  // information in the public signature chain. We also include the public ephemeral keys, which
  // will be used to verify Bob's proof of invitation; and a lockbox containing Bob's starter member
  // keys.

  const lockbox =
    newUserKeys !== undefined ? lockboxes.create(newUserKeys, ephemeralKeys) : undefined
  const invitationBody: InvitationBody = {
    userName,
    roles,
    publicKey: ephemeralKeys.signature.publicKey,
    lockbox,
  }
  const encryptedBody = symmetric.encrypt(invitationBody, teamKeys.secretKey)

  // We put it all together to create the invitation.
  return {
    id: deriveId(secretKey),
    encryptedBody,
    generation: teamKeys.generation,
    used: false,
    revoked: false,
  }
}
