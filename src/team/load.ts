import { LocalUserContext } from '/context'
import { Team } from '/team/Team'
import { TeamSignatureChain } from '/team/types'

export const load = (source: string | TeamSignatureChain, context: LocalUserContext) =>
  new Team({ source, context })
