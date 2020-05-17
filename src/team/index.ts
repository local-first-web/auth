export * from '/team/types'

import { EventEmitter } from 'events'
import { chain, SignatureChain, validate } from '/chain'
import { ContextWithSecrets } from '/context'
import { randomKey } from '/keys'
import { lockbox } from '/lockbox'
import { Member } from '/member'
import { ADMIN, Role, TEAM } from '/role'
import { ALL, initialState } from '/team/constants'
import { reducer } from '/team/reducer'
import * as selectors from '/team/selectors'
import { TeamState } from '/team/teamState'
import {
  isNew,
  NewTeamOptions,
  OldTeamOptions,
  TeamAction,
  TeamLink,
  TeamOptions,
} from '/team/types'
import { redactUser, User, UserWithSecrets } from '/user'

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

  public getKeysFromLockboxes = (user: UserWithSecrets) => {
    return selectors.getKeysFromLockboxes(this.state, user)
  }

  // WRITE METHODS
  // to mutate team state, we dispatch changes to the chain
  // and then run the chain through the reducer to recalculate team state

  public add = (user: User, roles: string[] = []) => {
    return this.dispatch({
      type: 'ADD_MEMBER',
      payload: { user, roles },
    })
  }

  public remove = (userName: string) => {
    return this.dispatch({
      type: 'REVOKE_MEMBER',
      payload: { userName },
    })
  }

  public addRole = (role: Role) => {
    return this.dispatch({
      type: 'ADD_ROLE',
      payload: role,
    })
  }

  public removeRole = (roleName: string) => {
    return this.dispatch({
      type: 'REVOKE_ROLE',
      payload: { roleName },
    })
  }

  public addMemberRole = (userName: string, roleName: string) => {
    return this.dispatch({
      type: 'ADD_MEMBER_ROLE',
      payload: { userName, roleName },
    })
  }

  public removeMemberRole = (userName: string, roleName: string) => {
    return this.dispatch({
      type: 'REVOKE_MEMBER_ROLE',
      payload: { userName, roleName },
    })
  }

  public invite = (userName: string) => {}
  public accept = (userName: string) => {}

  // private properties

  private chain: SignatureChain<TeamLink>
  private context: ContextWithSecrets
  private state: TeamState

  // private functions

  /** Create a new team with the current user as founding member */
  private create(options: NewTeamOptions) {
    const { teamName } = options

    // redact user's secret keys, since this will be written into the public chain
    const foundingMember = redactUser(options.context.user)

    // team and role secrets are never be stored in plaintext, only encrypted into individual lockboxes

    const teamLockbox = lockbox.create({
      scope: TEAM,
      recipient: foundingMember,
      secret: randomKey(),
    })

    const adminLockbox = lockbox.create({
      scope: ADMIN,
      recipient: foundingMember,
      secret: randomKey(),
    })

    // create root link
    this.chain = []
    this.dispatch({
      type: 'ROOT',
      payload: {
        teamName,
        foundingMember,
        lockboxes: [teamLockbox, adminLockbox],
      },
    })
  }

  /** Load a team from a serialized chain */
  private loadChain(options: OldTeamOptions) {
    this.chain = options.source
    this.updateState()
  }

  /** Add a link to the chain, then recompute team state from the new chain */
  public dispatch(link: TeamAction) {
    this.chain = chain.append(this.chain, link, this.context)
    this.updateState()
  }

  /** Validate the chain's integrity. (This does not enforce team rules - that is done in the
   * reducer as it progresses through each link. ) */
  private validateChain() {
    const validation = validate(this.chain)
    if (!validation.isValid) throw validation.error
  }

  private updateState = () => {
    this.validateChain()
    this.state = this.chain.reduce(reducer, initialState)
  }
}
