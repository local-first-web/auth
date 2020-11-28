import { signatures } from '@herbcaudill/crypto'
import { normalize } from './normalize'
import { Device } from '/device'
import { deriveId } from '/invitation/deriveId'
import { ProofOfInvitation } from '/invitation/types'
import { create, EPHEMERAL_SCOPE, KeyType } from '/keyset'
import { Member } from '/member'

const { DEVICE, MEMBER } = KeyType

export const acceptMemberInvitation = (secretKey: string, member: Member): ProofOfInvitation => {
  secretKey = normalize(secretKey)

  // ## Step 4

  // Bob independently derives the invitation id
  const id = deriveId(secretKey)

  // Bob uses the one-time signature keys to sign a message consisting of the invitation id,
  // along with public info about him
  const ephemeralKeys = create({ type: KeyType.MEMBER, name: member.userName }, secretKey)
  const signature = signatures.sign({ id, ...member }, ephemeralKeys.signature.secretKey)

  // The invitation id and the signature will be shown to an existing team member as proof that Bob
  // knows the secret invitation key. His user public keys and device public keys will be added to the signature chain.
  return { id, type: MEMBER, payload: member, signature }
}

export const acceptDeviceInvitation = (secretKey: string, device: Device): ProofOfInvitation => {
  // ## Step 4

  // Bob independently derives the invitation id
  const id = deriveId(secretKey)

  // Bob uses the one-time signature keys to sign a message consisting of the invitation id,
  // along with public info about him
  const signatureKeys = create(EPHEMERAL_SCOPE, secretKey).signature
  const signature = signatures.sign({ id, ...device }, signatureKeys.secretKey)

  // The invitation id and the signature will be shown to an existing team member as proof that Bob
  // knows the secret invitation key. His user public keys and device public keys will be added to the signature chain.
  return { id, type: DEVICE, payload: device, signature }
}
