import { Invitation, ProofOfInvitation } from '@/invitation/types'
import { memoize, VALID, ValidationResult } from '@/util'
import { signatures } from '@herbcaudill/crypto'

export const validate = memoize(
  (proof: ProofOfInvitation, invitation: Invitation): ValidationResult => {
    // Check that id from proof matches invitation
    const { id } = proof
    if (id !== invitation.id) return fail(`IDs don't match`, { proof, invitation })

    // Check signature on proof
    const { signature } = proof
    const payload = { id }
    const { publicKey } = invitation
    if (!signatures.verify({ payload, signature, publicKey }))
      return fail(`Signature provided is not valid`, { proof, invitation })

    return VALID
  }
)

export const fail = (message: string, details: any = null) =>
  ({
    isValid: false,
    error: new InvitationValidationError(message, details),
  } as ValidationResult)

export class InvitationValidationError extends Error {
  constructor(message: string, details?: any) {
    super()
    this.name = 'Invitation validation failed'
    this.message = message + '\n' + JSON.stringify(details, null, 2).replace(/\"/g, '')
    this.details = details
  }
  public index?: number
  public details?: any
}
