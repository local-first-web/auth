import { LocalUserContext } from '@/context/index.js'
import { Team } from '@/team/Team.js'
import { createKeyset } from 'crdx'
import { TEAM_SCOPE } from './constants.js'

export function createTeam(teamName: string, context: LocalUserContext, seed?: string) {
  const teamKeys = createKeyset(TEAM_SCOPE, seed)

  return new Team({ teamName, context, teamKeys })
}
