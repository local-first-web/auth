import * as keysets from '/keyset'

export const generateEphemeralKeys = (userName: string, secretKey: string) => {
  // Generate an ephemeral keyset. This will be Bob's first-use keyset; as soon as he's admitted,
  // he'll provide keys of his own choosing (with private keys that nobody else knows, including the
  // person who invited him).

  // From this keyset, we'll include the public signature key in the invitation, so other team
  // members can verify Bob's proof of invitation.

  // Since this keyset is derived from the secret invitation key, Bob can generate it independently.
  // Besides using it to generate his proof, he'll also need it to open lockboxes when he first joins.
  const scope = { type: keysets.KeyType.MEMBER, name: userName }
  const ephemeralKeys = keysets.create(scope, `${secretKey}:${userName}`)
  return ephemeralKeys
}
