import { KeysetWithSecrets } from '/keyset'
import { Invitation, InvitationPayload } from '/invitation'
import { symmetric } from '/crypto'

export const open = (invitation: Invitation, teamKeys: KeysetWithSecrets): InvitationPayload => {
  const decryptedPayload = symmetric.decrypt(invitation.encryptedPayload, teamKeys.secretKey)
  const invitationPayload = JSON.parse(decryptedPayload) as InvitationPayload
  return invitationPayload
}
