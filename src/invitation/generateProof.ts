import { base64, signatures } from '@herbcaudill/crypto'
import { generateEphemeralKeys } from './generateEphemeralKeys'
import { normalize } from './normalize'
import { deriveId } from '/invitation/deriveId'
import { ProofOfInvitation } from '/invitation/types'

export const generateProof = (secretKey: string, userName: string): ProofOfInvitation => {
  secretKey = normalize(secretKey)

  // Bob independently derives the invitation id and the ephemeral keys
  const id = deriveId(secretKey)
  const ephemeralKeys = generateEphemeralKeys(userName, secretKey)

  // Bob uses the ephemeral keys to sign a message consisting of
  // the invitation id and his username
  const payload = { id, userName }
  const signature = signatures.sign(payload, ephemeralKeys.signature.secretKey)

  // This signature will be shown to an existing team member as proof that
  // Bob knows the secret invitation key.
  const proof = { id, userName, signature } as ProofOfInvitation
  return proof
}
