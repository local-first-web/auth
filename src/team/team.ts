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
  AddRolePayload,
  RevokeRolePayload,
  AddMemberRolePayload,
  RevokeMemberRolePayload,
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

  // to read from team state, we rely on selectors

  public has = (userName: string) => selectors.hasMember(this.state, userName)

  // overloads
  public members(): Member[] // all members
  public members(userName: string): Member // one member

  // implementation
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

  // overloads
  public roles(): Role[] // all roles
  public roles(roleName: string): Role // one role

  // implementation
  public roles(roleName: string = ALL): Role | Role[] {
    return roleName === ALL
      ? this.state.roles
      : selectors.getRole(this.state, roleName)
  }

  // to mutate team state, we dispatch changes to the chain
  // and then run the chain through the reducer to recalculate team state

  public add = (user: User, roles: string[] = []) => {
    const payload: AddMemberPayload = { user, roles }
    this.dispatch({ type: linkType.ADD_MEMBER, payload })
  }

  public remove = (userName: string) => {
    const payload: RevokeMemberPayload = { userName }
    this.dispatch({ type: linkType.REVOKE_MEMBER, payload })
  }

  public addRole = (role: Role) => {
    const payload: AddRolePayload = role
    this.dispatch({ type: linkType.ADD_ROLE, payload })
  }

  public removeRole = (roleName: string) => {
    const payload: RevokeRolePayload = { roleName }
    this.dispatch({ type: linkType.REVOKE_ROLE, payload })
  }

  public addMemberRole = (userName: string, roleName: string) => {
    const payload: AddMemberRolePayload = { userName, roleName }
    this.dispatch({ type: linkType.ADD_MEMBER_ROLE, payload })
  }

  public removeMemberRole = (userName: string, roleName: string) => {
    const payload: RevokeMemberRolePayload = { userName, roleName }
    this.dispatch({ type: linkType.REVOKE_MEMBER_ROLE, payload })
  }

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
