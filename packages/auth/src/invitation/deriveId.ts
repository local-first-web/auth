import { type Hash, hash, stretch } from '@localfirst/crypto'
import { HashPurpose } from '../util/index.js'
import { normalize } from './normalize.js'

/** Derives the public invitation id from the secret invitation seed. */
export function deriveId(seed: string) {
  // Normalize here rather than relying on callers, so that a seed typed with spaces or passed in a
  // URL-safe form derives the same id
  seed = normalize(seed)

  // ## Step 1b
  // The iKey is stretched using `scrypt` to discourage brute-force attacks (docs refer to this as
  // the `siKey`)
  const stretchedKey = stretch(seed)

  // ## Step 1c
  // The invitation id is derived from the stretched iKey, so Bob can generate it independently.
  // This will be visible in the signature chain and serves to uniquely identify the invitation.
  // (Keybase docs: `inviteID`)
  return hash(HashPurpose.INVITATION, stretchedKey).slice(0, 15) as Hash
}
