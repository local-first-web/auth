import { TeamGraph } from './types'
import { LocalUserContext } from '@/context'
import { Team } from '@/team/Team'
import { KeysetWithSecrets } from 'crdx'

export const load = (
  source: string | TeamGraph,
  context: LocalUserContext,
  teamKeys: KeysetWithSecrets,
) => new Team({ source, context, teamKeys })
