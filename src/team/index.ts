import { EventEmitter } from 'events'
import { chain, SignatureChain, validate } from '/chain'
import { LocalUserContext } from '/context'
import { signatures, symmetric } from '/crypto'
import * as invitations from '/invitation'
import { ProofOfInvitation } from '/invitation'
import { ADMIN_SCOPE, KeyMetadata, KeyScope, Keys, KeyType, newKeys, TEAM_SCOPE } from '/keys'
import { Optional, Payload } from '/lib'
import * as lockbox from '/lockbox'
import { Member } from '/member'
import { ADMIN, Role } from '/role'
import { ALL, initialState } from '/team/constants'
import { reducer } from '/team/reducer'
import * as select from '/team/selectors'
import {
  EncryptedEnvelope,
  isNewTeam,
  SignedEnvelope,
  TeamAction,
  TeamLink,
  TeamOptions,
  TeamState,
} from '/team/types'
import { redactUser, LocalUser } from '/user'

export * from '/team/types'

const { TEAM, ROLE, MEMBER } = KeyType

export class Team extends EventEmitter {
  constructor(options: TeamOptions) {
    super()
    this.context = options.context

    if (isNewTeam(options)) {
      // Create a new team with the current user as founding member
      this.chain = []

      // Team & role secrets are never stored in plaintext, only encrypted into individual lockboxes.
      // Here we create new lockboxes with the team & admin keys for the founding member
      const teamLockbox = lockbox.create(newKeys(TEAM_SCOPE), this.context.user.keys)
      const adminLockbox = lockbox.create(newKeys(ADMIN_SCOPE), this.context.user.keys)

      // Post root link to signature chain
      this.dispatch({
        type: 'ROOT',
        payload: {
          teamName: options.teamName,
          rootMember: redactUser(this.context.user),
          lockboxes: [teamLockbox, adminLockbox],
        },
      })
    } else {
      // Load a team from a serialized chain
      this.chain = options.source
      this.updateState()
    }
  }

  // # PUBLIC API

  public get teamName() {
    return this.state.teamName
  }

  public save = () => JSON.stringify(this.chain)

  // ## READ METHODS
  // All the logic for reading from team state is in selectors.

  // Members

  /** Returns true if the team has a member with the given userName */
  public has = (userName: string) => select.hasMember(this.state, userName)

  /** Returns a list of all members on the team */
  public members(): Member[] // overload: all members
  /** Returns the member with the given user name*/
  public members(userName: string): Member // overload: one member
  //
  public members(userName: string = ALL): Member | Member[] {
    return userName === ALL //
      ? this.state.members // all members
      : select.member(this.state, userName) // one member
  }

  // Roles

  /** Returns all roles in the team */
  public roles(): Role[]
  /** Returns the role with the given name */
  public roles(roleName: string): Role
  //
  public roles(roleName: string = ALL): Role | Role[] {
    return roleName === ALL //
      ? this.state.roles // all roles
      : select.role(this.state, roleName) // one role
  }

  /** Returns true if the member with the given userName has the given role*/
  public memberHasRole = (userName: string, roleName: string) =>
    select.memberHasRole(this.state, userName, roleName)

  /** Returns true if the member with the given userName is a member of the 3 role */
  public memberIsAdmin = (userName: string) => select.memberIsAdmin(this.state, userName)

  /** Returns true if the team has a role with the given name*/
  public hasRole = (roleName: string) => select.hasRole(this.state, roleName)

  /** Returns a list of members who have the given role */
  public membersInRole = (roleName: string): Member[] => select.membersInRole(this.state, roleName)

  /** Returns a list of members who are in the admin role */
  public admins = (): Member[] => select.admins(this.state)

  // Keys

  /** Returns the keyset (if available to the current user) for the given type and name */
  public keys = (scope: Optional<KeyMetadata, 'generation'>): Keys =>
    select.keys(this.state, this.context.user, scope)

  /** Returns the team keyset */
  public teamKeys = (): Keys => this.keys(TEAM_SCOPE)

  /** Returns the keys for the given role */
  public roleKeys = (roleName: string): Keys => this.keys({ type: ROLE, name: roleName })

  /** Returns the admin keyset */
  public adminKeys = (): Keys => this.roleKeys(ADMIN)

  // ## WRITE METHODS

  // Most of the logic for modifying team state is in reducers. To mutate team state, we dispatch
  // changes to the signature chain, and then run the chain through the reducer to recalculate team
  // state.

  // Any crypto operations involving the current user's secrets (for example, opening or creating
  // lockboxes, signing links) are done here. Only the public-facing outputs (for example, the
  // resulting lockboxes, the signed links) are posted on the chain.

  /** Adds a member */
  public add = (user: Member | LocalUser, roles: string[] = []) => {
    // don't leak user secrets if we have them
    const redactedUser = redactUser(user)

    // make lockboxes for the new member
    const teamLockbox = lockbox.create(this.teamKeys(), user.keys)
    const roleLockboxes = roles.map(roleName => lockbox.create(this.roleKeys(roleName), user.keys))
    const lockboxes = [teamLockbox, ...roleLockboxes]

    // post the member to the signature chain
    this.dispatch({
      type: 'ADD_MEMBER',
      payload: { member: redactedUser, roles, lockboxes },
    })
  }

  /** Removes a member */
  public remove = (userName: string) => {
    // create new keys & lockboxes for any keys this person had access to
    const lockboxes = this.rotateKeys({ type: MEMBER, name: userName })

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
    const roleKeys = newKeys({ type: ROLE, name: role.roleName })

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
    const lockboxes = this.rotateKeys({ type: ROLE, name: roleName })

    // post the removal to the signature chain
    this.dispatch({
      type: 'REMOVE_MEMBER_ROLE',
      payload: { userName, roleName, lockboxes },
    })
  }

  /** Invites a new member to the team */
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

  /** Admits a new member to the team based on proof of invitation */
  public admit = (proof: ProofOfInvitation) => {
    const { id, member: user } = proof
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
      payload: { id, member: user, roles },
    })
  }

  // ## CRYPTO API

  /**
   * Symmetrically encrypts a payload for the given scope using keys available to the current user.
   *
   * > *Note*: Since this convenience function uses symmetric encryption, we can only use it to
   * encrypt for scopes the current user has keys for (e.g. the whole team, or roles they belong
   * to). If we need to encrypt asymmetrically, we use the functions in the crypto module directly.
   */
  public encrypt = (payload: Payload, roleName?: string): EncryptedEnvelope => {
    const scope = roleName ? { type: ROLE, name: roleName } : TEAM_SCOPE
    const {
      encryption: { secretKey }, // TODO: go back to having a separate key for symmetric encryption
      generation,
    } = this.keys(scope)
    return {
      contents: symmetric.encrypt(payload, secretKey),
      recipient: { ...scope, generation },
    }
  }

  /** Decrypts a payload using keys available to the current user. */
  public decrypt = (message: EncryptedEnvelope): string => {
    const { secretKey } = this.keys(message.recipient).encryption
    return symmetric.decrypt(message.contents, secretKey)
  }

  /** Signs a message using the current user's keys. */
  public sign = (payload: Payload): SignedEnvelope => ({
    contents: payload,
    signature: signatures.sign(payload, this.context.user.keys.signature.secretKey),
    author: {
      type: MEMBER,
      name: this.context.user.userName,
      generation: this.context.user.keys.generation,
    },
  })

  /** Verifies a signed message against the author's public key */
  public verify = (message: SignedEnvelope): boolean =>
    signatures.verify({
      payload: message.contents,
      signature: message.signature,
      publicKey: this.members(message.author.name).keys.signature, // TODO: This will always check against the author's current keys (latest generation)
    })

  // # PRIVATE PROPERTIES

  private context: LocalUserContext
  private chain: SignatureChain<TeamLink>
  private state: TeamState // derived from chain, only updated by running chain through reducer

  // # PRIVATE METHODS

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

    /* Run the chain through the reducer to calculate the current team state */
    this.state = this.chain.reduce(reducer, initialState)
  }

  /** Given a compromised scope (e.g. a member or a role), finds all scopes that are visible from that
   * scope, and generates new keys and lockboxes for each of those. Returns all of the new lockboxes in
   * a single array to be posted to the signature chain. */
  private rotateKeys(compromisedScope: KeyScope) {
    // make a list containing this scope plus all scopes that it sees
    const compromisedScopes = select.scopesToRotate(this.state, compromisedScope)

    // generate new keys and lockboxes for each one
    const newLockboxes = compromisedScopes.flatMap(scope => {
      const keys = newKeys(scope)
      const oldLockboxes = select.lockboxesInScope(this.state, scope)
      const newLockboxes = oldLockboxes.map(oldLockbox => lockbox.rotate(oldLockbox, keys))
      return newLockboxes
    })

    return newLockboxes
  }
}
