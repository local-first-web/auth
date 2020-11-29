import { signatures, symmetric } from '@herbcaudill/crypto'
import { Invitation, InvitationBody, ProofOfInvitation } from '/invitation/types'
import { KeysetWithSecrets } from '/keyset'
import { VALID, ValidationResult } from '/util'

export const validate = (
  proof: ProofOfInvitation,
  invitation: Invitation,
  teamKeys: KeysetWithSecrets
): ValidationResult => {
  // Decrypt and parse invitation
  const decryptedBody = symmetric.decrypt(invitation.encryptedBody, teamKeys.secretKey)
  const invitationBody = JSON.parse(decryptedBody) as InvitationBody
  const details = { invitationBody, proof }

  // Check that IDs and user names from proof match invitation
  const { id, userName } = proof
  if (id !== invitation.id) return fail(`IDs don't match`, details)
  if (userName !== invitationBody.userName) return fail(`User names don't match`, details)

  // Check signature on proof
  const { signature } = proof
  const payload = { id, userName }
  const { publicKey } = invitationBody
  if (!signatures.verify({ payload, signature, publicKey }))
    return fail(`Signature provided is not valid`, details)

  return VALID
}

const fail = (message: string, details: any) =>
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
