import { signatures } from '@herbcaudill/crypto'
import memoize from 'fast-memoize'
import { generateStarterKeys } from './generateStarterKeys'
import { normalize } from './normalize'
import { deriveId } from '/invitation/deriveId'
import { Invitee, ProofOfInvitation } from '/invitation/types'
import { KeyType } from '/keyset'

export const generateProof = memoize(
  (seed: string, invitee: string | Invitee): ProofOfInvitation => {
    if (typeof invitee === 'string') invitee = { type: KeyType.MEMBER, name: invitee } as Invitee

    seed = normalize(seed)

    // Bob independently derives the invitation id and the ephemeral keys
    const { name } = invitee
    const id = deriveId(seed, name)
    const ephemeralKeys = generateStarterKeys(invitee, seed)

    // Bob uses the ephemeral keys to sign a message consisting of
    // the invitation id and his username
    const payload = { id, name }
    const signature = signatures.sign(payload, ephemeralKeys.signature.secretKey)

    // This signature will be shown to an existing team member as proof that
    // Bob knows the secret invitation key.
    const proof = { id, invitee, signature } as ProofOfInvitation
    return proof
  }
)
