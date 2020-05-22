import { deriveId } from '/invitation/deriveId'
import { ProofOfInvitation } from '/invitation/types'
import { signatures } from '/crypto'
import { deriveKeys } from '/keys'
import { User } from '/user/types'

export const accept = (key: string, user: User): ProofOfInvitation => {
  // ## Step 4

  // Bob independently derives the invitation id
  const id = deriveId(key)

  // Bob uses the one-time signature keys to sign a message consisting of his username and public keys, and the invitation id
  const { secretKey } = deriveKeys(key).signature
  const signature = signatures.sign({ user, id }, secretKey)

  // The invitation id and the signature will be shown to an existing team member as proof that Bob
  // knows the secret invitation key
  return { id, user, signature }
}
