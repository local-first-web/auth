import { LocalUserContext } from '/context'
import { Team } from '/team/Team'

export const create = (teamName: string, context: LocalUserContext) =>
  new Team({ teamName, context })
