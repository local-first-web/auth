import { Invitation, InvitationState, ProofOfInvitation } from '@/invitation/types'
import { memoize, VALID, ValidationResult } from '@/util'
import { signatures } from '@herbcaudill/crypto'

// TODO consistent naming (invitationCanBeUsed vs validate)

export const invitationCanBeUsed = (invitation: InvitationState, timeOfUse: number) => {
  if (invitation.revoked) {
    return fail(`This invitation has been revoked.`, invitation)
  }

  if (invitation.maxUses > 0 && invitation.uses >= invitation.maxUses) {
    return fail(`This invitation cannot be used again.`, invitation)
  }

  if (invitation.expiration > 0 && invitation.expiration < timeOfUse) {
    return fail(`This invitation has expired.`, invitation)
  }

  return VALID
}

export const validate = memoize(
  (proof: ProofOfInvitation, invitation: Invitation): ValidationResult => {
    // Check that id from proof matches invitation
    const { id } = proof
    if (id !== invitation.id) return fail(`IDs don't match`, { proof, invitation })

    // Check signature on proof against public key from invitation
    const { signature } = proof
    const { publicKey } = invitation
    const payload = { id }
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
