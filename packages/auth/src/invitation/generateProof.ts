import { memoize } from '@localfirst/shared'
import { signatures } from '@localfirst/crypto'
import { deriveId } from 'invitation/deriveId.js'
import { type ProofOfInvitation } from 'invitation/types.js'
import { generateStarterKeys } from './generateStarterKeys.js'
import { normalize } from './normalize.js'

/**
 * Generates the proof that an invitee presents to an existing member to show that they hold the
 * secret invitation seed.
 *
 * The proof is bound to the identifier the invitee will be admitted under, so that it can only be
 * used to admit that one identity. Without that binding, anyone who intercepts the proof could
 * present it as their own and be admitted under keys of their choosing.
 */
export const generateProof = memoize(
  (
    /** The secret invitation seed, passed to the invitee via a side channel */
    seed: string,
    /** The invitee's `userId` (member invitation) or `deviceId` (device invitation) */
    invitee: string
  ): ProofOfInvitation => {
    seed = normalize(seed)

    // Bob independently derives the invitation id and the ephemeral keys
    const id = deriveId(seed)
    const ephemeralKeys = generateStarterKeys(seed)

    // Bob uses the ephemeral keys to sign a message consisting of the invitation id and the
    // identifier he's asking to be admitted under
    const payload = { id, invitee }
    const signature = signatures.sign(payload, ephemeralKeys.signature.secretKey)

    // This signature will be shown to an existing team admin as proof that Bob knows the secret
    // invitation key.
    return { id, invitee, signature }
  },
  (seed, invitee) => `${normalize(seed)}:${invitee}`
)
