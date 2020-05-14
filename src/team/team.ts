import { EventEmitter } from 'events'
import { chain, PartialLinkBody, SignatureChain, validate } from '../chain'
import { ContextWithSecrets } from '../context'
import { deriveKeys, KeysetWithSecrets, randomKey, redactKeys } from '../keys'
import { Member } from '../member'
import { Role } from '../role'
import { redactUser, User } from '../user'
import { ALL, initialState } from './constants'
import { reducer } from './reducer'
import * as selectors from './selectors'
import { TeamState } from './teamState'
import {
  AddMemberPayload,
  ExistingTeamOptions,
  includesSource,
  linkType,
  NewTeamOptions,
  RevokeMemberPayload,
  RootPayload,
  TeamOptions,
} from './types'

export class Team extends EventEmitter {
  constructor(options: TeamOptions) {
    super()

    this.context = options.context

    if (includesSource(options)) this.loadChain(options)
    else this.create(options)
  }

  // public API

  public get teamName() {
    return this.state.teamName
  }

  public save = () => JSON.stringify(this.chain)

  // read

  public has = (userName: string) => selectors.hasMember(this.state, userName)

  public members(): Member[]
  public members(userName: string): Member
  public members(userName: string = ALL): Member | Member[] {
    return userName === ALL
      ? this.state.members
      : selectors.getMember(this.state, userName)
  }

  public memberHasRole(userName: string, role: string) {
    return selectors.memberHasRole(this.state, userName, role)
  }

  public memberIsAdmin(userName: string) {
    return selectors.memberIsAdmin(this.state, userName)
  }

  public hasRole = (roleName: string) => selectors.hasRole(this.state, roleName)

  public roles(): Role[]
  public roles(roleName: string): Role
  public roles(roleName: string = ALL): Role | Role[] {
    return roleName === ALL
      ? this.state.roles
      : selectors.getRole(this.state, roleName)
  }

  // write

  public add = (user: User, roles: string[] = []) => {
    const payload: AddMemberPayload = { user, roles }
    this.dispatch({ type: linkType.ADD_MEMBER, payload })
  }

  public remove = (userName: string) => {
    const payload: RevokeMemberPayload = { userName }
    this.dispatch({ type: linkType.REVOKE_MEMBER, payload })
  }

  public addRole = (role: Role) => {}
  public removeRole = (roleName: string) => {}

  public addMemberRole = (userName: string, roleName: string) => {}
  public removeMemberRole = (userName: string, roleName: string) => {}

  public invite = (userName: string) => {}
  public accept = (userName: string) => {}

  // private properties

  private chain: SignatureChain
  private context: ContextWithSecrets
  private state: TeamState

  // private functions

  private validateChain() {
    const validation = validate(this.chain)
    if (!validation.isValid) throw validation.error
  }

  private updateState = () => {
    this.validateChain()
    this.state = this.chain.reduce<TeamState>(reducer, initialState)
  }

  private create(options: NewTeamOptions) {
    // the team secret will never be stored in plaintext, only encrypted into individual lockboxes
    const teamSecret = randomKey()
    const teamKeys = deriveKeys(teamSecret)

    // redact user's secret keys, since this will be written into the public chain
    const user = redactUser(options.context.user)

    // create root link
    this.initializeChain(options.teamName, teamKeys, user)
  }

  private loadChain(options: ExistingTeamOptions) {
    this.chain = options.source
    this.updateState()
  }

  private initializeChain(
    teamName: string,
    teamKeys: KeysetWithSecrets,
    foundingMember: User
  ) {
    const publicKeys = redactKeys(teamKeys)
    const payload: RootPayload = {
      teamName,
      publicKeys,
      foundingMember,
    }
    this.chain = []
    this.dispatch({ type: linkType.ROOT, payload })
  }

  public dispatch(link: PartialLinkBody) {
    this.chain = chain.append(this.chain, link, this.context)
    this.updateState()
  }
}
