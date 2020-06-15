import { signatures } from '/crypto'
import { deriveId } from '/invitation/deriveId'
import { normalize } from '/invitation/normalize'
import { ProofOfInvitation } from '/invitation/types'
import { create, EPHEMERAL_SCOPE } from '/keyset'
import { Member } from '/member'

export const acceptInvitation = (secretKey: string, member: Member): ProofOfInvitation => {
  secretKey = normalize(secretKey)

  // ## Step 4

  // Bob independently derives the invitation id
  const id = deriveId(secretKey)

  // Bob uses the one-time signature keys to sign a message consisting of his username and public keys, and the invitation id
  const signatureKeys = create(EPHEMERAL_SCOPE, secretKey).signature
  const signature = signatures.sign({ member, id }, signatureKeys.secretKey)

  // The invitation id and the signature will be shown to an existing team member as proof that Bob
  // knows the secret invitation key
  return { id, member, signature }
}
