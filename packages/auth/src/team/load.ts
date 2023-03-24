import { LocalContext } from '@/context'
import { Team } from '@/team/Team'
import { KeysetWithSecrets } from 'crdx'
import { TeamGraph } from './types'

export const load = (
  source: string | TeamGraph,
  context: LocalContext,
  teamKeys: KeysetWithSecrets,
) => new Team({ source, context, teamKeys })
