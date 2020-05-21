import { EventEmitter } from 'events'
import { chain, SignatureChain, validate } from '/chain'
import { ContextWithSecrets } from '/context'
import { randomKey, KeysetWithSecrets } from '/keys'
import { lockbox } from '/lockbox'
import { Member } from '/member'
import { ADMIN, Role, TEAM } from '/role'
import { ALL, initialState } from '/team/constants'
import { reducer } from '/team/reducer'
import * as selectors from '/team/selectors'
import * as invitations from '/invitation'
import {
  isNew,
  NewTeamOptions,
  OldTeamOptions,
  TeamAction,
  TeamLink,
  TeamOptions,
  TeamState,
  KeysetMap,
} from '/team/types'
import { redactUser, User } from '/user'

export * from '/team/types'

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
    return userName === ALL //
      ? this.state.members // all members
      : selectors.getMember(this.state, userName) // one member
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
    return roleName === ALL ? this.state.roles : selectors.getRole(this.state, roleName)
  }

  public keys(): KeysetMap // overload: all keysets
  public keys(keyName: string): KeysetWithSecrets // overload: one keyset
  public keys(scope: string = ALL): KeysetMap | KeysetWithSecrets {
    const lockboxes = selectors.getKeys(this.state, this.context.user)
    return scope === ALL ? lockboxes : lockboxes[scope]
  }

  // WRITE METHODS
  // to mutate team state, we dispatch changes to the chain
  // and then run the chain through the reducer to recalculate team state

  public add = (user: User, roles: string[] = []) => {
    this.dispatch({
      type: 'ADD_MEMBER',
      payload: { user, roles },
    })
  }

  public remove = (userName: string) => {
    this.dispatch({
      type: 'REVOKE_MEMBER',
      payload: { userName },
    })
  }

  public addRole = (role: Role) => {
    this.dispatch({
      type: 'ADD_ROLE',
      payload: role,
    })
  }

  public removeRole = (roleName: string) => {
    this.dispatch({
      type: 'REVOKE_ROLE',
      payload: { roleName },
    })
  }

  public addMemberRole = (userName: string, roleName: string) => {
    this.dispatch({
      type: 'ADD_MEMBER_ROLE',
      payload: { userName, roleName },
    })
  }

  public removeMemberRole = (userName: string, roleName: string) => {
    this.dispatch({
      type: 'REVOKE_MEMBER_ROLE',
      payload: { userName, roleName },
    })
  }

  public invite = (
    userName: string,
    roles: string[] = [],
    secretKey = invitations.newSecretKey()
  ) => {
    // generate invitation
    const teamKeys = this.keys(TEAM)
    const invitation = invitations.create({ teamKeys, userName, roles, secretKey })

    // post invitation to signature chain
    this.dispatch({
      type: 'POST_INVITATION',
      payload: { invitation },
    })

    // return the secret key to be passed on to the invitee
    return secretKey
  }

  public admit = (userName: string) => {}

  // private properties

  private chain: SignatureChain<TeamLink>
  private context: ContextWithSecrets
  private state: TeamState

  // private functions

  /** Create a new team with the current user as founding member */
  private create(options: NewTeamOptions) {
    const { teamName } = options

    // Redact user's secret keys, since this will be written into the public chain
    const rootMember = redactUser(options.context.user)

    // Team and role secrets are never stored in plaintext, only encrypted into individual
    // lockboxes

    // These are the lockboxes for the founding member
    const teamLockbox = lockbox.create({
      scope: TEAM,
      recipient: rootMember,
      secret: randomKey(),
    })
    const adminLockbox = lockbox.create({
      scope: ADMIN,
      recipient: rootMember,
      secret: randomKey(),
    })

    // create root link
    this.chain = []
    this.dispatch({
      type: 'ROOT',
      payload: { teamName, rootMember, lockboxes: [teamLockbox, adminLockbox] },
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

  /** Runs the reducer on the entire chain to calculate the current team state. */
  private updateState = () => {
    this.validateChain()
    this.state = this.chain.reduce(reducer, initialState)
  }
}
