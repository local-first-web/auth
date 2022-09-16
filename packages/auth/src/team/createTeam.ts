import { LocalUserContext } from '@/context'
import { Team } from '@/team/Team'
import { createKeyset } from 'crdx'
import { TEAM_SCOPE } from './constants'

export function createTeam(teamName: string, context: LocalUserContext, seed?: string) {
  const teamKeys = createKeyset(TEAM_SCOPE, seed)

  return new Team({ teamName, context, teamKeys })
}
