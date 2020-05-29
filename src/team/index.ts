import { EventEmitter } from 'events'
import { chain, SignatureChain, validate } from '/chain'
import { ContextWithSecrets } from '/context'
import * as invitations from '/invitation'
import { ProofOfInvitation } from '/invitation'
import { KeysetScope, KeysetWithSecrets, randomKey, generateKeys, newKeys } from '/keys'
import * as lockbox from '/lockbox'
import { Member } from '/member'
import { ADMIN, Role } from '/role'
import { ALL, initialState } from '/team/constants'
import { reducer } from '/team/reducer'
import * as select from '/team/selectors'
import {
  ExistingTeamOptions,
  isNew,
  NewTeamOptions,
  TeamAction,
  TeamLink,
  TeamOptions,
  TeamState,
} from '/team/types'
import { redactUser, User, UserWithSecrets } from '/user'

export * from '/team/types'

const { TEAM, ROLE } = KeysetScope

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

  // Members

  /** Returns true if the team has a member with the given userName */
  public has = (userName: string) => select.hasMember(this.state, userName)

  /** Returns a list of all members on the team */
  public members(): Member[] // overload: all members

  /** Returns the member with the given user name*/
  public members(userName: string): Member // overload: one member

  public members(userName: string = ALL): Member | Member[] {
    return userName === ALL //
      ? this.state.members // all members
      : select.getMember(this.state, userName) // one member
  }

  // Roles

  /** Returns all roles in the team */
  public roles(): Role[] // overload: all roles

  /** Returns the role with the given name */
  public roles(roleName: string): Role // overload: one role

  public roles(roleName: string = ALL): Role | Role[] {
    return roleName === ALL //
      ? this.state.roles // all roles
      : select.getRole(this.state, roleName) // one role
  }

  /** Returns true if the member with the given userName has the given role*/
  public memberHasRole = (userName: string, roleName: string) =>
    select.memberHasRole(this.state, userName, roleName)

  // TODO allow other roles to have admin rights?

  /** Returns true if the member with the given userName is a member of the admin role */
  public memberIsAdmin = (userName: string) => select.memberIsAdmin(this.state, userName)

  /** Returns true if the team has a role with the given name*/
  public hasRole = (roleName: string) => select.hasRole(this.state, roleName)

  /** Returns a list of members who have the given role */
  public membersInRole = (roleName: string): Member[] => select.membersInRole(this.state, roleName)

  /** Returns a list of members who are in the admin role */
  public admins = (): Member[] => select.admins(this.state)

  // Keys

  /** Returns a keyset (if found) for the given scope and name */
  public keys(scope: KeysetScope, name: string = scope): KeysetWithSecrets | undefined {
    const lockboxes = select.getKeys(this.state, this.context.user)
    if (lockboxes[scope] === undefined) return undefined
    return lockboxes[scope][name]
  }

  /** Returns the team's keyset */
  public teamKeys(): KeysetWithSecrets {
    const keys = this.keys(TEAM)
    if (keys === undefined) throw new Error('Team keys not found')
    return keys
  }

  /** Returns the keys for the given role */
  public roleKeys(roleName: string): KeysetWithSecrets {
    const keys = this.keys(ROLE, roleName)
    if (keys === undefined) throw new Error(`Keys not found for role '${roleName}'`)
    return keys
  }

  /** Returns the admin keyset */
  public adminKeys = (): KeysetWithSecrets => this.roleKeys(ADMIN)

  // WRITE METHODS
  // Most of the logic for modifying team state is in reducers. To mutate team state, we dispatch
  // changes to the signature chain, and then run the chain through the reducer to recalculate team
  // state.

  // Any crypto operations involving the current user's secrets (for example, opening or creating
  // lockboxes, signing links) are done here. Only the public-facing outputs (for example, the
  // resulting lockboxes, the signed links) are posted on the chain.

  /** Adds a user */
  public add = (user: User, roles: string[] = []) => {
    // make lockboxes for the new member
    const teamLockbox = lockbox.create(this.teamKeys(), user.keys)
    const roleLockboxes = roles.map(roleName => lockbox.create(this.roleKeys(roleName), user.keys))
    const lockboxes = [teamLockbox, ...roleLockboxes]

    // post the member to the signature chain
    this.dispatch({
      type: 'ADD_MEMBER',
      payload: { user, roles, lockboxes },
    })
  }

  /** Removes a user */
  public remove = (userName: string) => {
    this.dispatch({
      type: 'REVOKE_MEMBER',
      payload: { userName },
    })
  }

  /** Adds a role */
  public addRole = (role: Role) => {
    // we're creating this role so we need to generate new keys
    const roleKeys = newKeys({ scope: ROLE, name: role.roleName })

    // make lockboxes for all current admins
    // TODO: Make a lockbox for the admin role instead
    const lockboxes = this.admins().map(user => lockbox.create(roleKeys, user.keys))

    // post the role to the signature chain
    this.dispatch({
      type: 'ADD_ROLE',
      payload: { ...role, lockboxes },
    })
  }

  // NEXT: wire up revoking lockboxes

  /** Removes a role */
  public removeRole = (roleName: string) => {
    this.dispatch({
      type: 'REVOKE_ROLE',
      payload: { roleName },
    })
  }

  /** Gives a member a role */
  public addMemberRole = (userName: string, roleName: string) => {
    // make a lockbox for the role
    const roleLockbox = lockbox.create(this.roleKeys(roleName), this.members(userName).keys)

    // post the member role to the signature chain
    this.dispatch({
      type: 'ADD_MEMBER_ROLE',
      payload: { userName, roleName, lockboxes: [roleLockbox] },
    })
  }

  /** Removes a role from a member */
  public removeMemberRole = (userName: string, roleName: string) => {
    this.dispatch({
      type: 'REVOKE_MEMBER_ROLE',
      payload: { userName, roleName },
    })
  }

  /** Invites a user */
  public invite = (
    userName: string,
    roles: string[] = [],
    secretKey = invitations.newSecretKey()
  ) => {
    // generate invitation
    const teamKeys = this.teamKeys()
    const invitation = invitations.create({ teamKeys, userName, roles, secretKey })

    // post invitation to signature chain
    this.dispatch({
      type: 'POST_INVITATION',
      payload: { invitation },
    })

    // return the secret key to be passed on to the invitee
    return secretKey
  }

  public admit = (proof: ProofOfInvitation) => {
    const { id, user } = proof
    const teamKeys = this.teamKeys()

    // look up the invitation
    const invitation = this.state.invitations[id]
    if (invitation === undefined) throw new Error(`An invitation with id '${id}' was not found.`)

    // open the invitation
    const { roles } = invitations.open(invitation, teamKeys)

    // validate proof against original invitation
    const validation = invitations.validate(proof, invitation, teamKeys)
    if (validation.isValid === false) throw validation.error

    // all good, let them in

    // post admission to the signature chain
    this.dispatch({
      type: 'ADMIT_INVITED_MEMBER',
      payload: { id, user, roles },
    })
  }

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

    // Generate new team and admin keysets
    const teamKeys = newKeys({ scope: TEAM })
    const adminKeys = newKeys({ scope: ROLE, name: ADMIN })

    // Team & role secrets are never stored in plaintext, only encrypted into individual lockboxes.
    // Here we create new lockboxes with the team & admin keys for the founding member
    const teamLockbox = lockbox.create(teamKeys, rootMember.keys)
    const adminLockbox = lockbox.create(adminKeys, rootMember.keys)
    const lockboxes = [teamLockbox, adminLockbox]

    this.chain = []

    // Post root link to signature chain
    this.dispatch({
      type: 'ROOT',
      payload: { teamName, rootMember, lockboxes },
    })
  }

  /** Load a team from a serialized chain */
  private loadChain(options: ExistingTeamOptions) {
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

  /** Runs the reducer on the entire chain to reconstruct the current team state. */
  private updateState = () => {
    /** Validate the chain's integrity. (This does not enforce team rules - that is done in the
     * reducer as it progresses through each link. ) */
    const validation = validate(this.chain)
    if (!validation.isValid) throw validation.error

    this.state = this.chain.reduce(reducer, initialState)
  }
}
