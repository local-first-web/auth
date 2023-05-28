import { LocalContext } from '@/context'
import { Team } from '@/team/Team'
import { Keyring, KeysetWithSecrets, createKeyring } from '@localfirst/crdx'
import { TeamGraph } from './types'

export const load = (
  source: string | TeamGraph,
  context: LocalContext,
  teamKeys: KeysetWithSecrets | Keyring
) => {
  const teamKeyring = createKeyring(teamKeys)
  return new Team({ source, context, teamKeyring })
}
