import { LocalUserContext } from '@/context'
import { Team } from '@/team/Team'

export function create(teamName: string, context: LocalUserContext, seed?: string) {
  return new Team({ teamName, context })
}
