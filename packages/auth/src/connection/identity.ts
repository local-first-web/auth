import { signatures, randomKey } from '@localfirst/crypto'
import { Challenge } from '@/connection/types'
import { Base58, KeyScope, KeysetWithSecrets, Keyset, UnixTimestamp } from '@localfirst/crdx'
import { VALID, ValidationResult } from '@/util'

export const challenge = (identityClaim: KeyScope): Challenge => ({
  ...identityClaim,
  nonce: randomKey(),
  timestamp: new Date().getTime() as UnixTimestamp,
})

export const prove = (challenge: Challenge, keys: KeysetWithSecrets): Base58 =>
  signatures.sign(challenge, keys.signature.secretKey)

export const verify = (
  challenge: Challenge,
  signature: Base58,
  publicKeys: Keyset
): ValidationResult => {
  const details = { challenge, signature }

  const signatureIsValid = signatures.verify({
    payload: challenge,
    signature,
    publicKey: publicKeys.signature,
  })
  if (!signatureIsValid) return fail('Signature is not valid', details)

  return VALID
}

const fail = (message: string, details: any) => {
  return {
    isValid: false,
    error: new IdentityChallengeFailure(message, details),
  } as ValidationResult
}

export class IdentityChallengeFailure extends Error {
  constructor(message: string, details?: any) {
    super()
    this.name = 'Identity challenge failed'
    this.message = message + '\n' + JSON.stringify(details, null, 2).replace(/\"/g, '')
    this.details = details
  }
  public details?: any
}
