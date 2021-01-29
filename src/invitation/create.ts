import { symmetric } from '@herbcaudill/crypto'
import { generateEphemeralKeys } from '/invitation/generateEphemeralKeys'
import { deriveId } from '/invitation/deriveId'
import { normalize } from '/invitation/normalize'
import { Invitation, InvitationBody } from '/invitation/types'
import { KeysetWithSecrets } from '/keyset'

export const IKEY_LENGTH = 16

/**
 * Returns an an invitation to publicly post on the team's signature chain.
 * A loosely adapted implementation of Keybase's Seitan Token v2 exchange protocol.
 */
export const create = ({ invitationSeed, userName, teamKeys }: CreateOptions): Invitation => {
  // Alice generates the ephemeral keys from the invitation seed (Bob will do the same on his side)
  invitationSeed = normalize(invitationSeed)
  const ephemeralKeys = generateEphemeralKeys(userName, invitationSeed)

  const invitationBody: InvitationBody = {
    // Bob's user name
    userName,

    // the ephemeral public signature key will be used to verify Bob's proof of invitation
    publicKey: ephemeralKeys.signature.publicKey,
  }

  return {
    // the ID of the invitation is derived from the seed
    id: deriveId(invitationSeed, userName),

    // We encrypt the body to avoid leaking info (this invite will be publicly posted on the chain)
    encryptedBody: symmetric.encrypt(invitationBody, teamKeys.secretKey),

    // TODO: I don't think we're currently taking this into account
    generation: teamKeys.generation,
  }
}

interface CreateOptions {
  /** A randomly generated secret to be passed to Bob via a side channel */
  invitationSeed: string

  /** The user to invite */
  userName: string

  /** The global team keys (Alice obtains these from the appropriate lockbox) */
  teamKeys: KeysetWithSecrets
}
