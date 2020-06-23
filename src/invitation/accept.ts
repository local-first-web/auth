import { signatures } from '/crypto'
import { deriveId } from '/invitation/deriveId'
import { normalize } from '/invitation/normalize'
import { ProofOfInvitation } from '/invitation/types'
import { create, EPHEMERAL_SCOPE, redact as redactKeyset } from '/keyset'
import { redact as redactUser, User } from '/user'

export const acceptInvitation = (secretKey: string, user: User): ProofOfInvitation => {
  // don't leak secrets to the signature chain
  const member = redactUser(user)
  const device = {
    userName: user.userName,
    name: user.device.name,
    type: user.device.type,
    keys: redactKeyset(user.device.keys),
  }

  secretKey = normalize(secretKey)

  // ## Step 4

  // Bob independently derives the invitation id
  const id = deriveId(secretKey)

  // Bob uses the one-time signature keys to sign a message consisting of his username and public keys, and the invitation id
  const signatureKeys = create(EPHEMERAL_SCOPE, secretKey).signature
  const payload = { id, member, device }
  const signature = signatures.sign(payload, signatureKeys.secretKey)

  // The invitation id and the signature will be shown to an existing team member as proof that Bob
  // knows the secret invitation key. His user public keys and device public keys will be added to the signature chain.
  return { ...payload, signature }
}
