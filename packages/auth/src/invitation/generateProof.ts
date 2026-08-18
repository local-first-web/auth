import { type Keyset, type KeysetWithSecrets } from '@localfirst/crdx'
import { memoize } from '@localfirst/shared'
import { signatures } from '@localfirst/crypto'
import { deriveId } from 'invitation/deriveId.js'
import { hashKeys } from 'invitation/hashKeys.js'
import { type ProofOfInvitation } from 'invitation/types.js'
import { generateStarterKeys } from './generateStarterKeys.js'
import { normalize } from './normalize.js'

/**
 * Generates the proof that an invitee presents to an existing member to show that they hold the
 * secret invitation seed.
 *
 * The proof commits to the invitee's own keys: it names the identifier they'll be admitted under
 * (which is the name on their keyset — their `userId` for a member invitation, their `deviceId` for
 * a device invitation) and fingerprints the keyset itself. Both bindings matter. Without the
 * identifier, anyone who intercepts the proof could present it as their own; without the
 * fingerprint, the admitter could admit the invitee under keys of the ADMITTER's choosing — keys
 * the admitter holds the secrets for — and then act as the invitee indefinitely.
 */
export const generateProof = memoize(
  (
    /** The secret invitation seed, passed to the invitee via a side channel */
    seed: string,
    /** The invitee's own public keys: their user keys for a member invitation, their device keys for
     * a device invitation. Secret keys are accepted and stripped, to simplify testing. */
    keys: Keyset | KeysetWithSecrets
  ): ProofOfInvitation => {
    seed = normalize(seed)

    // Bob independently derives the invitation id and the ephemeral keys
    const id = deriveId(seed)
    const ephemeralKeys = generateStarterKeys(seed)

    // Bob uses the ephemeral keys to sign a message consisting of the invitation id, the identifier
    // he's asking to be admitted under, and a fingerprint of the keys he's asking to be admitted with
    const invitee = keys.name
    const keyHash = hashKeys(keys)
    const payload = { id, invitee, keyHash }
    const signature = signatures.sign(payload, ephemeralKeys.signature.secretKey)

    // This signature will be shown to an existing team admin as proof that Bob knows the secret
    // invitation key.
    return { id, invitee, keyHash, signature }
  },
  // The key fingerprint covers the invitee's name, so it's enough to distinguish proofs on its own
  (seed, keys) => `${normalize(seed)}:${hashKeys(keys)}`
)
