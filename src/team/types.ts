import { SignatureChain } from '../chain'
import { Context, ContextWithSecrets } from '../context'
import { PublicKeyset } from '../keys'
import { Lockbox } from '../lockbox'

export interface TeamState {
  name: string
  rootContext?: Context
  members: Member[]
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

export type TeamOptions = NewTeamOptions | ExistingTeamOptions

// type guard for NewTeamOptions vs ExistingTeam Options
export function exists(options: TeamOptions): options is ExistingTeamOptions {
  return (options as ExistingTeamOptions).source !== undefined
}

export interface RootLinkPayload {
  name: string
  rootContext: Context
  lockboxes: Lockbox[]
}

export interface Member {
  name: string
  keys: PublicKeyset
  roles: string[]
}
