import { Invitation, InvitationPayload, ProofOfInvitation } from '/invitation/types'
import { ValidationResult } from '/chain'
import { signatures, symmetric } from '/crypto'
import { KeysetWithSecrets } from '/keys'

export const validate = (
  proof: ProofOfInvitation,
  invitation: Invitation,
  teamKeys: KeysetWithSecrets
) => {
  const { id, encryptedPayload } = invitation
  const details = { invitation, proof }

  if (id !== proof.id) return fail(`IDs don't match`, details)

  const decryptedInvitation = symmetric.decrypt(encryptedPayload, teamKeys.symmetric.key)
  const invitationPayload: InvitationPayload = JSON.parse(decryptedInvitation)
  const { userName, publicKey } = invitationPayload

  if (userName !== proof.userName)
    return fail(`User names don't match`, { invitationPayload, ...details })

  const payload = { userName, id }
  const { signature } = proof
  const signedMessage = { payload, signature, publicKey }
  const signatureIsValid = signatures.verify(signedMessage)

  if (!signatureIsValid)
    return fail(`Signature provided is not valid`, { signedMessage, ...details })

  // TODO: invite hasn't already been used
  // TODO: invite hasn't expired
  // TODO: invite hasn't been revoked
  return VALID
}

const fail = (message: string, details: any) => {
  return {
    isValid: false,
    error: new InvitationValidationError(message, details),
  }
}

const VALID = { isValid: true } as ValidationResult

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
