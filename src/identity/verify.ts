import { signatures } from '/crypto'
import { PublicKeyset } from '/keyset'
import { ChallengeIdentityMessage, ProveIdentityMessage } from '/message'
import { ValidationResult } from '/chain'

export const verify = (
  { payload: challenge }: ChallengeIdentityMessage,
  { payload: proof }: ProveIdentityMessage,
  publicKeys: PublicKeyset
): ValidationResult => {
  const details = { proof, challenge }

  if (proof.challenge !== challenge) return fail('Challenge document does not match', details)

  const signatureIsValid = signatures.verify({
    payload: challenge,
    signature: proof.signature,
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
