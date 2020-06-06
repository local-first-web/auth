import { deriveId } from '/invitation/deriveId'
import { ProofOfInvitation } from '/invitation/types'
import { signatures } from '/crypto'
import { generateKeys } from '/keys'
import { Member } from '/member'

export const accept = (key: string, member: Member): ProofOfInvitation => {
  // ## Step 4

  // Bob independently derives the invitation id
  const id = deriveId(key)

  // Bob uses the one-time signature keys to sign a message consisting of his username and public keys, and the invitation id
  const { secretKey } = generateKeys(key).signature
  const signature = signatures.sign({ member, id }, secretKey)

  // The invitation id and the signature will be shown to an existing team member as proof that Bob
  // knows the secret invitation key
  return { id, member, signature }
}
