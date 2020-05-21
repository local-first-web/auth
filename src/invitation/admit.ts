import { Invitation, ProofOfInvitation } from './types'
import { KeysetWithSecrets } from '/keys'
import { validate } from './validate'

export const admit = (
  proof: ProofOfInvitation,
  invitation: Invitation,
  teamKeys: KeysetWithSecrets
) => {
  const validation = validate(proof, invitation, teamKeys)
  if (!validation.isValid) throw validation.error
  // TODO: Add this person to the team
}
