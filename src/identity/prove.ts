import { signatures } from '@herbcaudill/crypto'
import { Challenge } from '/identity/types'
import { KeysetWithSecrets } from '/keyset'
import { Base64 } from '/util'

export const prove = (challenge: Challenge, keys: KeysetWithSecrets): Base64 =>
  signatures.sign(challenge, keys.signature.secretKey)
