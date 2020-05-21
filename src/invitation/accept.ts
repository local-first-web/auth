import { deriveId } from '/invitation/deriveId'
import { ProofOfInvitation } from '/invitation/types'
import { signatures } from '/crypto'
import { deriveKeys } from '/keys'

export const accept = (key: string, userName: string): ProofOfInvitation => {
  // ## Step 4

  // Bob independently derives the invitation id
  const id = deriveId(key)

  // Bob signs a message consisting of his username and the invitation id
  const { secretKey } = deriveKeys(key).signature
  const signature = signatures.sign({ userName, id }, secretKey)

  // The invitation id and the signature will be shown to an existing team member as proof that Bob
  // knows the secret invitation key
  return { id, userName, signature }
}
