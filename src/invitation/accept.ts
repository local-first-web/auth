import { signatures } from '/crypto'
import { redact as redactDevice } from '/device'
import { deriveId } from '/invitation/deriveId'
import { normalize } from '/invitation/normalize'
import { ProofOfInvitation } from '/invitation/types'
import { create, EPHEMERAL_SCOPE } from '/keyset'
import { redact as redactUser, User } from '/user'

export const acceptMemberInvitation = (secretKey: string, user: User): ProofOfInvitation => {
  // don't leak secrets to the signature chain
  const member = redactUser(user)
  const device = redactDevice(user.device)

  secretKey = normalize(secretKey)

  // ## Step 4

  // Bob independently derives the invitation id
  const id = deriveId(secretKey)

  // Bob uses the one-time signature keys to sign a message consisting of the invitation id,
  // along with public info about him and his initial device
  const signatureKeys = create(EPHEMERAL_SCOPE, secretKey).signature
  const payload = { id, member, device }
  const signature = signatures.sign(payload, signatureKeys.secretKey)

  // The invitation id and the signature will be shown to an existing team member as proof that Bob
  // knows the secret invitation key. His user public keys and device public keys will be added to the signature chain.
  return { ...payload, signature }
}
