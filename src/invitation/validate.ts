import { Invitation, InvitationBody, ProofOfInvitation } from '/invitation/types'
import { ValidationResult } from '/util'
import { signatures, symmetric } from '/crypto'
import { KeysetWithSecrets } from '/keyset'

export const validate = (
  proof: ProofOfInvitation,
  invitation: Invitation,
  teamKeys: KeysetWithSecrets
) => {
  const { id, encryptedBody: encryptedPayload } = invitation
  const details = { invitation, proof }

  if (id !== proof.id) return fail(`IDs don't match`, details)

  const decryptedInvitation = symmetric.decrypt(encryptedPayload, teamKeys.secretKey)
  const invitationBody: InvitationBody = JSON.parse(decryptedInvitation)
  const { publicKey, type, payload } = invitationBody

  if (type !== 'MEMBER') throw new Error() // TODO

  if (payload.userName !== proof.member.userName)
    return fail(`User names don't match`, { invitationPayload: invitationBody, ...details })

  const { signature, member, device } = proof
  const signedMessage = { payload: { id, member, device }, signature, publicKey }
  const signatureIsValid = signatures.verify(signedMessage)

  if (!signatureIsValid)
    return fail(`Signature provided is not valid`, { signedMessage, ...details })

  // TODO: invite hasn't already been used
  // TODO: invite hasn't expired
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
