import { KeysetWithSecrets } from '/keys'
import { Invitation, InvitationPayload } from '/invitation'
import { symmetric } from '/crypto'

export const open = (invitation: Invitation, teamKeys: KeysetWithSecrets): InvitationPayload => {
  const { key } = teamKeys.symmetric
  return JSON.parse(symmetric.decrypt(invitation.encryptedPayload, key)) as InvitationPayload
}
