import { LocalUserContext } from '@/context'
import { Team } from '@/team/Team'

export function createTeam(teamName: string, context: LocalUserContext, seed?: string) {
  return new Team({ teamName, context, seed })
}
