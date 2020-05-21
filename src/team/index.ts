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
import { redactUser, User, UserWithSecrets } from '/user'

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

  // All the logic for reading from team state is in selectors.

  public members(): Member[] // overload: all members
  public members(userName: string): Member // overload: one member
  //
  public members(userName: string = ALL): Member | Member[] {
    return userName === ALL //
      ? this.state.members // all members
      : selectors.getMember(this.state, userName) // one member
  }

  public roles(): Role[] // overload: all roles
  public roles(roleName: string): Role // overload: one role
  //
  public roles(roleName: string = ALL): Role | Role[] {
    return roleName === ALL //
      ? this.state.roles // all roles
      : selectors.getRole(this.state, roleName) // one role
  }

  public keys(): KeysetMap // overload: all keysets
  public keys(keyName: string): KeysetWithSecrets // overload: one keyset
  //
  public keys(scope: string = ALL): KeysetMap | KeysetWithSecrets {
    const lockboxes = selectors.getKeys(this.state, this.context.user)
    return scope === ALL //
      ? lockboxes // keysets from all of the current member's lockboxes
      : lockboxes[scope] // only the keysets for the given scope
  }

  /** Returns true if the team has a member with the given userName */
  public has = (userName: string) => selectors.hasMember(this.state, userName)

  /** Returns true if the member with the given userName has the given role*/
  public memberHasRole = (userName: string, roleName: string) =>
    selectors.memberHasRole(this.state, userName, roleName)

  /** Returns true if the member with the given userName is a member of the admin role */
  public memberIsAdmin = (userName: string) => selectors.memberIsAdmin(this.state, userName)

  /** Returns true if the team has a role with the given name */
  public hasRole = (roleName: string) => selectors.hasRole(this.state, roleName)

  // WRITE METHODS

  // Most of the logic for modifying team state is in reducers. To mutate team state, we dispatch
  // changes to the signature chain, and then run the chain through the reducer to recalculate team
  // state.

  // Any crypto operations involving the current user's secrets (for example, opening or creating lockboxes, or
  // signing links) are done here. Only the public-facing outputs (for example, the lockboxes or the
  // signed links) are posted on the chain.

  public add = (user: User, roles: string[] = []) => {
    const lockboxes = this.createLockboxes([TEAM, ...roles], user)
    this.dispatch({
      type: 'ADD_MEMBER',
      payload: { user, roles, lockboxes },
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
    // TODO: create lockboxes
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
    const rootMember = redactUser(this.context.user)

    // Team & role secrets are never stored in plaintext, only encrypted into individual lockboxes
    // Here we create new lockboxes with new random keys for the founding member
    const lockboxes = this.createLockboxes([TEAM, ADMIN])

    // create root link
    this.chain = []
    this.dispatch({
      type: 'ROOT',
      payload: { teamName, rootMember, lockboxes },
    })
  }

  private createLockboxes = (
    scopes: string[],
    recipient: User | UserWithSecrets = this.context.user
  ) =>
    scopes.map(scope => {
      const isOwnLockbox = recipient.userName === this.context.user.userName
      const secret = isOwnLockbox
        ? // if we're creating our own lockbox, that means the key doesn't exist yet so we create a new one
          randomKey()
        : // otherwise we're sharing a key that we already have, so we look it up in our existing lockboxes
          this.keys(scope).seed
      return lockbox.create({ scope, recipient, secret })
    })

  /** Load a team from a serialized chain */
  private loadChain(options: OldTeamOptions) {
    this.chain = options.source
    this.updateState()
  }

  /** Add a link to the chain, then recompute team state from the new chain */
  public dispatch(link: TeamAction) {
    this.chain = chain.append(this.chain, link, this.context)
    // TODO: this is doing more work than necessary - we don't have to calculate the team state from
    // scratch each time, we could just run the previous state and this link through the reducer
    // function
    this.updateState()
  }

  /** Validate the chain's integrity. (This does not enforce team rules - that is done in the
   * reducer as it progresses through each link. ) */
  private validateChain() {
    const validation = validate(this.chain)
    if (!validation.isValid) throw validation.error
  }

  /** Runs the reducer on the entire chain to reconstruct the current team state. */
  private updateState = () => {
    this.validateChain()
    this.state = this.chain.reduce(reducer, initialState)
  }
}
