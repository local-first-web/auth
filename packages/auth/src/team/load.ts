import { TeamGraph } from './types.js'
import { LocalUserContext } from '@/context/index.js'
import { Team } from '@/team/Team.js'
import { KeysetWithSecrets } from 'crdx'

export const load = (
  source: string | TeamGraph,
  context: LocalUserContext,
  teamKeys: KeysetWithSecrets,
) => new Team({ source, context, teamKeys })
