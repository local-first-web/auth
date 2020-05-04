import { SignatureChain } from '../chain'
import { Context, ContextWithSecrets } from '../context'

export interface TeamState {
  name: string
  rootContext?: Context
  members: string[]
  roles: string[]
}

export interface NewTeamOptions {
  name: string
  context: ContextWithSecrets
}

export interface ExistingTeamOptions {
  source: SignatureChain
  context: ContextWithSecrets
}

export type TeamOptions = NewTeamOptions | ExistingTeamOptions // type guard

export function isExistingTeam(
  options: TeamOptions
): options is ExistingTeamOptions {
  return (options as ExistingTeamOptions).source !== undefined
}

export interface RootLinkPayload {
  name: string
  rootContext: Context
}
