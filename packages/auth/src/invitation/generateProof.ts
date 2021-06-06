import { deriveId } from '@/invitation/deriveId'
import { ProofOfInvitation } from '@/invitation/types'
import { PublicKeyset } from '@/keyset'
import { memoize } from '@/util'
import { signatures } from '@herbcaudill/crypto'
import { generateStarterKeys } from './generateStarterKeys'
import { normalize } from './normalize'

export const generateProof = memoize(
  (seed: string, keys: PublicKeyset): ProofOfInvitation => {
    seed = normalize(seed)

    // Bob independently derives the invitation id and the ephemeral keys
    const id = deriveId(seed)
    const ephemeralKeys = generateStarterKeys(seed)

    // We take Bob's username from the keyset. (For a device, this is the device name.)
    const { name } = keys

    // Bob uses the ephemeral keys to sign a message consisting of
    // the invitation id and his username
    const payload = { id, name }
    const signature = signatures.sign(payload, ephemeralKeys.signature.secretKey)

    // This signature will be shown to an existing team admin as proof that Bob knows the secret
    // invitation key. Bob's actual public keys will be posted on the signature chain.
    return { id, signature, keys }
  }
)
