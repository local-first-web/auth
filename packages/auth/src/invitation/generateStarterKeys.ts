import { normalize } from './normalize'
import * as keysets from '@/keyset'
import { KeyScope } from '@/keyset'

/**
 * This will be Bob's first-use keyset; as soon as he's admitted, he'll provide keys of his own
 * choosing (with private keys that nobody else knows, including the person who invited him). From
 * this keyset, we'll include the public signature key in the invitation, so other team members can
 * verify Bob's proof of invitation.
 *
 * Since this keyset is derived from the secret invitation seed, Bob can generate it independently.
 * Besides using it to generate his proof, he'll also need it to open lockboxes when he first joins.
 *
 * @param scope the scope of the person being invited, e.g. `{type: MEMBER, name: 'bob'}`
 * @param seed the secret invitation seed
 * @returns the new keyset
 */
export const generateStarterKeys = (scope: KeyScope, seed: string) => {
  seed = normalize(seed)
  const starterKeys = keysets.create(scope, `${seed}:${scope.name}`)
  return starterKeys
}
