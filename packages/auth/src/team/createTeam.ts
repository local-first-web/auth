import { LocalContext } from '@/context'
import { Team } from '@/team/Team'
import { createKeyset } from '@localfirst/crdx'
import { TEAM_SCOPE } from './constants'

export function createTeam(teamName: string, context: LocalContext, seed?: string) {
  const teamKeys = createKeyset(TEAM_SCOPE, seed)

  return new Team({ teamName, context, teamKeys })
}
