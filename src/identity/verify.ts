import { Base64, signatures } from '@herbcaudill/crypto'
import { PublicKeyset } from '/keyset'
import { Challenge } from '/identity'
import { ValidationResult } from '/util'

export const verify = (
  challenge: Challenge,
  signature: Base64,
  publicKeys: PublicKeyset
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

const VALID = { isValid: true } as ValidationResult

export class IdentityChallengeFailure extends Error {
  constructor(message: string, details?: any) {
    super()
    this.name = 'Identity challenge failed'
    this.message = message + '\n' + JSON.stringify(details, null, 2).replace(/\"/g, '')
    this.details = details
  }
  public details?: any
}
