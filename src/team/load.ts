import { LocalUserContext } from '/context'
import { Team } from '/team/Team'

export const load = (source: string, context: LocalUserContext) => new Team({ source, context })
