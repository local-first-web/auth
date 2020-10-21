import { open } from './open'
import { signatures } from '@herbcaudill/crypto'
import { Invitation, ProofOfInvitation } from '/invitation/types'
import { KeysetWithSecrets } from '/keyset'
import { ValidationResult } from '/util'

export const validate = (
  proof: ProofOfInvitation,
  encryptedInvitation: Invitation,
  teamKeys: KeysetWithSecrets
) => {
  // Decrypt invitation
  const invitation = open(encryptedInvitation, teamKeys)
  const details = { invitation, proof }

  // Check that IDs match
  if (encryptedInvitation.id !== proof.id) return fail(`IDs don't match`, details)

  if (invitation.type === 'MEMBER' && proof.type === 'MEMBER') {
    // Member invitation: Check that userNames match
    if (invitation.payload.userName !== proof.payload.userName)
      return fail(`User names don't match`, details)
  } else if (invitation.type === 'DEVICE' && proof.type === 'DEVICE') {
    // Device invitation: Check that deviceIds match
    if (invitation.payload.deviceId !== proof.payload.deviceId)
      return fail(`Device IDs don't match`, details)
  }

  // Check signature on proof
  const signedMessage = {
    payload: { id: proof.id, ...proof.payload },
    signature: proof.signature,
    publicKey: invitation.publicKey,
  }
  if (!signatures.verify(signedMessage))
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
