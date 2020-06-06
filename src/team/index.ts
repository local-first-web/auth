import { EventEmitter } from 'events'
import { chain, SignatureChain, validate } from '/chain'
import { ContextWithSecrets } from '/context'
import * as invitations from '/invitation'
import { ProofOfInvitation } from '/invitation'
import { KeysetScope, KeysetWithSecrets, newKeys, PublicKeyset, KeyNode } from '/keys'
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
import { Base64 } from '/lib'

export * from '/team/types'

const { TEAM, ROLE, MEMBER, DEVICE } = KeysetScope

export class Team extends EventEmitter {
  constructor(options: TeamOptions) {
    super()
    this.context = options.context

    if (isNew(options)) {
      // Create a new team with the current user as founding member
      this.chain = []

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

      // Post root link to signature chain
      this.dispatch({
        type: 'ROOT',
        payload: { teamName: options.teamName, rootMember, lockboxes },
      })
    } else {
      // Load a team from a serialized chain
      this.chain = options.source
      this.updateState()
    }
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

  /** Returns true if the member with the given userName is a member of the 3 role */
  public memberIsAdmin = (userName: string) => select.memberIsAdmin(this.state, userName)

  /** Returns true if the team has a role with the given name*/
  public hasRole = (roleName: string) => select.hasRole(this.state, roleName)

  /** Returns a list of members who have the given role */
  public membersInRole = (roleName: string): Member[] => select.membersInRole(this.state, roleName)

  /** Returns a list of members who are in the admin role */
  public admins = (): Member[] => select.admins(this.state)

  // Keys

  /** Returns a keyset (if found) for the given scope and name */
  public keys(scope: KeysetScope, name: string = scope): KeysetWithSecrets {
    const keysFromLockboxes = select.getMyKeys(this.state, this.context.user)
    const keys = keysFromLockboxes[scope] && keysFromLockboxes[scope][name]
    if (!keys) throw new Error(`Keys not found for ${scope.toLowerCase()} '${name}`)
    return keys[keys.length - 1] // return the most recent one we have
  }

  /** Returns the team keyset */
  public teamKeys = (): KeysetWithSecrets => this.keys(TEAM)

  /** Returns the keys for the given role */
  public roleKeys = (roleName: string): KeysetWithSecrets => this.keys(ROLE, roleName)

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
  public add = (user: User | UserWithSecrets, roles: string[] = []) => {
    // don't leak user secrets if we have them
    const redactedUser = redactUser(user)

    // make lockboxes for the new member
    const teamLockbox = lockbox.create(this.teamKeys(), user.keys)
    const roleLockboxes = roles.map(roleName => lockbox.create(this.roleKeys(roleName), user.keys))
    const lockboxes = [teamLockbox, ...roleLockboxes]

    // post the member to the signature chain
    this.dispatch({
      type: 'ADD_MEMBER',
      payload: { user: redactedUser, roles, lockboxes },
    })
  }

  /** Removes a user */
  public remove = (userName: string) => {
    // create new keys & lockboxes for any keys this person had access to
    const lockboxes = this.rotateKeys({ scope: MEMBER, name: userName })

    // post the removal to the signature chain
    this.dispatch({
      type: 'REMOVE_MEMBER',
      payload: {
        userName,
        lockboxes,
      },
    })
  }

  /** Adds a role */
  public addRole = (role: Role) => {
    // we're creating this role so we need to generate new keys
    const roleKeys = newKeys({ scope: ROLE, name: role.roleName })

    // make a lockbox for the admin role, so that all admins can access this role's keys
    const lockboxForAdmin = lockbox.create(roleKeys, this.adminKeys())

    // post the role to the signature chain
    this.dispatch({
      type: 'ADD_ROLE',
      payload: { ...role, lockboxes: [lockboxForAdmin] },
    })
  }

  /** Removes a role */
  public removeRole = (roleName: string) => {
    this.dispatch({
      type: 'REMOVE_ROLE',
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
    // create new keys & lockboxes for any keys this person had access to via this role
    const lockboxes = this.rotateKeys({ scope: ROLE, name: roleName })

    // post the removal to the signature chain
    this.dispatch({
      type: 'REMOVE_MEMBER_ROLE',
      payload: { userName, roleName, lockboxes },
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

  // private methods

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
     * reducer as it progresses through each link.) */
    const validation = validate(this.chain)
    if (!validation.isValid) throw validation.error

    this.state = this.chain.reduce(reducer, initialState)
  }

  /** Given a compromised node (e.g. a member or a role), finds all nodes that are visible from that
   * node, and generates new keys and lockboxes for each of those. Returns all of the new lockboxes in
   * a single array to be posted to the signature chain. */
  private rotateKeys(compromisedNode: KeyNode) {
    // make a list containing this node plus all nodes that it sees
    const compromisedNodes = select.getNodesToRotate(this.state, compromisedNode)

    // generate new keys and lockboxes for each one
    const rotateNodeKeys = (node: KeyNode) => {
      // create a new keyset for this scope
      const replacementKeys = newKeys(node)

      // find all lockboxes containing keys for this node
      const oldLockboxes = select.getLockboxesForNode(this.state, node)

      // replace each one with a new one
      return oldLockboxes.map(oldLockbox => lockbox.rotate(oldLockbox, replacementKeys))
    }
    const newLockboxes = compromisedNodes.flatMap(rotateNodeKeys)

    return newLockboxes
  }
}
