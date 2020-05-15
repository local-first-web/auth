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
  OldTeamOptions,
  isNew,
  NewTeamOptions,
  TeamOptions,
  TeamAction,
  TeamLink,
} from './types'

export class Team extends EventEmitter {
  constructor(options: TeamOptions) {
    super()

    this.context = options.context

    if (isNew(options)) this.create(options)
    else this.loadChain(options)
  }

  // PUBLIC API

  public get teamName() {
    return this.state.teamName
  }

  public save = () => JSON.stringify(this.chain)

  // READ METHODS
  // to read from team state, we rely on selectors

  public has = (userName: string) => selectors.hasMember(this.state, userName)

  public members(): Member[] // overload: all members
  public members(userName: string): Member // overload: one member
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

  public roles(): Role[] // overload: all roles
  public roles(roleName: string): Role // overload: one role
  public roles(roleName: string = ALL): Role | Role[] {
    return roleName === ALL
      ? this.state.roles
      : selectors.getRole(this.state, roleName)
  }

  // WRITE METHODS
  // to mutate team state, we dispatch changes to the chain
  // and then run the chain through the reducer to recalculate team state

  public add = (user: User, roles: string[] = []) =>
    this.dispatch({
      type: 'ADD_MEMBER',
      payload: { user, roles },
    })

  public remove = (userName: string) =>
    this.dispatch({
      type: 'REVOKE_MEMBER',
      payload: { userName },
    })

  public addRole = (role: Role) =>
    this.dispatch({
      type: 'ADD_ROLE',
      payload: role,
    })

  public removeRole = (roleName: string) =>
    this.dispatch({
      type: 'REVOKE_ROLE',
      payload: { roleName },
    })

  public addMemberRole = (userName: string, roleName: string) =>
    this.dispatch({
      type: 'ADD_MEMBER_ROLE',
      payload: { userName, roleName },
    })

  public removeMemberRole = (userName: string, roleName: string) =>
    this.dispatch({
      type: 'REVOKE_MEMBER_ROLE',
      payload: { userName, roleName },
    })

  public invite = (userName: string) => {}
  public accept = (userName: string) => {}

  // private properties

  private chain: SignatureChain<TeamLink>
  private context: ContextWithSecrets
  private state: TeamState

  // private functions

  private validateChain() {
    const validation = validate(this.chain)
    if (!validation.isValid) throw validation.error
  }

  private updateState = () => {
    this.validateChain()
    this.state = this.chain.reduce(reducer, initialState)
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

  private loadChain(options: OldTeamOptions) {
    this.chain = options.source
    this.updateState()
  }

  private initializeChain(
    teamName: string,
    teamKeys: KeysetWithSecrets,
    foundingMember: User
  ) {
    const publicKeys = redactKeys(teamKeys)
    const payload = {
      teamName,
      publicKeys,
      foundingMember,
    }
    this.chain = []
    this.dispatch({ type: 'ROOT', payload })
  }

  public dispatch(link: TeamAction) {
    this.chain = chain.append(this.chain, link, this.context)
    this.updateState()
  }
}
