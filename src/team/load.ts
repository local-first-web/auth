import { TeamSignatureChain } from './types'
import { LocalUserContext } from '/context'
import { Team } from '/team/Team'

export const load = (source: string | TeamSignatureChain, context: LocalUserContext) =>
  new Team({ source, context })
