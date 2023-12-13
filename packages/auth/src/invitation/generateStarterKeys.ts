import { createKeyset, EPHEMERAL_SCOPE } from '@localfirst/crdx'
import { normalize } from './normalize.js'
import { memoize } from '@localfirst/auth-shared'

/**
 * This will be Bob's first-use keyset; as soon as he's admitted, he'll provide keys of his own
 * choosing (with private keys that nobody else knows, including the person who invited him). From
 * this keyset, we'll include the public signature key in the invitation, so other team members can
 * verify Bob's proof of invitation.
 *
 * Since this keyset is derived from the secret invitation seed, Bob can generate it independently.
 * Besides using it to generate his proof, he'll also need it to open lockboxes when he first joins.
 */
export const generateStarterKeys = memoize((seed: string) => {
  seed = normalize(seed)
  return createKeyset(EPHEMERAL_SCOPE, seed)
})
