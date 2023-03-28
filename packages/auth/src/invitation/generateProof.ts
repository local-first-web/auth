import { deriveId } from '@/invitation/deriveId'
import { ProofOfInvitation } from '@/invitation/types'
import { memoize } from '@/util'
import { signatures } from '@localfirst/crypto'
import { generateStarterKeys } from './generateStarterKeys'
import { normalize } from './normalize'

export const generateProof = memoize((seed: string): ProofOfInvitation => {
  seed = normalize(seed)

  // Bob independently derives the invitation id and the ephemeral keys
  const id = deriveId(seed)
  const ephemeralKeys = generateStarterKeys(seed)

  // Bob uses the ephemeral keys to sign a message consisting of the invitation id
  const payload = { id }
  const signature = signatures.sign(payload, ephemeralKeys.signature.secretKey)

  // This signature will be shown to an existing team admin as proof that Bob knows the secret
  // invitation key.
  return { id, signature }
})
