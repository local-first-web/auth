import { KeysetWithSecrets } from '/keyset'
import { Invitation, InvitationBody } from '/invitation'
import { symmetric } from '/crypto'

export const open = (invitation: Invitation, teamKeys: KeysetWithSecrets): InvitationBody => {
  const decryptedBody = symmetric.decrypt(invitation.encryptedBody, teamKeys.secretKey)
  const invitationBody = JSON.parse(decryptedBody) as InvitationBody
  return invitationBody
}
