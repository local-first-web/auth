import { Invitation, InvitationState, ProofOfInvitation } from '@/invitation/types'
import { memoize, VALID, ValidationResult } from '@/util'
import { signatures } from '@herbcaudill/crypto'

export const invitationCanBeUsed = (invitation: InvitationState, timeOfUse: number) => {
  const { revoked, maxUses, uses, expiration } = invitation
  if (revoked) return fail(`This invitation has been revoked.`)
  if (maxUses > 0 && uses >= maxUses) return fail(`This invitation cannot be used again.`)
  if (expiration > 0 && expiration < timeOfUse) return fail(`This invitation has expired.`)

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
    const signatureIsValid = signatures.verify({ payload, signature, publicKey })
    if (!signatureIsValid) return fail(`Signature provided is not valid`, { proof, invitation })

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
