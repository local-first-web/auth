import { SignatureChain } from '/chain'
import { LocalUserContext } from '/context'
import { Team } from '/team/Team'
import { TeamLink } from '/team/types'

export const load = (source: SignatureChain<TeamLink>, context: LocalUserContext) =>
  new Team({ source, context })
