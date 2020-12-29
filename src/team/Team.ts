import { randomKey, signatures, symmetric } from '@herbcaudill/crypto'
import { EventEmitter } from 'events'
import * as chains from '/chain'
import { membershipResolver, TeamAction, TeamActionLink, TeamSignatureChain } from '/chain'
import { LocalUserContext } from '/context'
import { DeviceInfo, getDeviceId, redactDevice } from '/device'
import * as invitations from '/invitation'
import { ProofOfInvitation } from '/invitation'
import { normalize } from '/invitation/normalize'
import * as keysets from '/keyset'
import {
  ADMIN_SCOPE,
  isKeyset,
  KeyMetadata,
  KeyScope,
  KeysetWithSecrets,
  KeyType,
  PublicKeyset,
  redactKeys,
  TEAM_SCOPE,
} from '/keyset'
import { getScope } from '/keyset/getScope'
import * as lockbox from '/lockbox'
import { Member } from '/member'
import { ADMIN, Role } from '/role'
import { ALL, initialState } from '/team/constants'
import { reducer } from '/team/reducer'
import * as select from '/team/selectors'
import { getVisibleScopes } from '/team/selectors'
import { EncryptedEnvelope, isNewTeam, SignedEnvelope, TeamOptions, TeamState } from '/team/types'
import * as users from '/user'
import { User } from '/user'
import { assert, debug, Hash, Optional, Payload } from '/util'
import { chainSummary } from '/util/chainSummary'

const { DEVICE, ROLE, MEMBER } = KeyType

/**
 * The `Team` class wraps a `TeamSignatureChain` and exposes methods for adding and removing
 * members, assigning roles, creating and using invitations, and encrypting messages for
 * individuals, for the team, or for members of specific roles.
 */
export class Team extends EventEmitter {
  public chain: TeamSignatureChain
  private context: LocalUserContext
  private state: TeamState = initialState // derived from chain, only updated by running chain through reducer
  private log: (o: any) => void
  private seed: string

  /**
   * We can make a team instance either by creating a brand-new team, or restoring one from a stored
   * signature chain.
   * @param options.context The context of the local user (userName, keys, device, client).
   * @param options.source (only when rehydrating from a chain) The `TeamSignatureChain`
   * representing the team's state. Can be serialized or not.
   * @param options.teamName (only when creating a new team) The team's human-facing name.
   * @param options.seed A seed for generating keys. This is typically only used for testing, to ensure predictable data.
   */
  constructor(options: TeamOptions) {
    super()
    this.seed = options.seed ?? randomKey()
    this.context = options.context
    this.log = (o: any) =>
      debug(`taco:team:${this.context.user.userName}`)(
        typeof o !== 'string' ? JSON.stringify(o, null, 2) : o
      )

    if (isNewTeam(options)) {
      // Create a new team with the current user as founding member
      const localUser = this.context.user

      // Team & role secrets are never stored in plaintext, only encrypted into individual lockboxes.
      // Here we create new lockboxes with the team & admin keys for the founding member
      const teamLockbox = lockbox.create(keysets.create(TEAM_SCOPE, this.seed), localUser.keys)
      const adminLockbox = lockbox.create(keysets.create(ADMIN_SCOPE, this.seed), localUser.keys)

      // Post root link to signature chain
      const payload = {
        teamName: options.teamName,
        rootMember: users.redactUser(localUser),
        lockboxes: [teamLockbox, adminLockbox],
      }
      this.chain = chains.create<TeamAction>(payload, this.context)
    } else {
      // Load a team from an existing chain
      this.chain = maybeDeserialize(options.source)
    }
    this.updateState()
  }

  /**************** TEAM STATE
    
  All the logic for reading from team state is in selectors.
  
  Most of the logic for modifying team state is in reducers. To mutate team state, we dispatch
  changes to the signature chain, and then run the chain through the reducer to recalculate team
  state.
  
  Any crypto operations involving the current user's secrets (for example, opening or creating
  lockboxes, or signing links) are done here. Only the public-facing outputs (for example, the
  resulting lockboxesInScope, the signed links) are posted on the chain.
  
  */

  public get teamName() {
    return this.state.teamName
  }

  public save = () => chains.serialize(this.chain)

  public merge = (theirChain: TeamSignatureChain) => {
    this.chain = chains.merge(this.chain, theirChain)
    this.updateState()
    return this
  }

  /** Add a link to the chain, then recompute team state from the new chain */
  public dispatch(action: TeamAction) {
    this.chain = chains.append(this.chain, action, this.context)
    // get the newly appended link
    const head = chains.getHead(this.chain) as TeamActionLink

    // we don't need to pass the whole chain through the reducer, just the current state + the new head
    this.log(chainSummary(this.chain))
    this.state = reducer(this.state, head)

    this.emit('updated', { head: this.chain.head })
  }

  /** Run the reducer on the entire chain to reconstruct the current team state. */
  private updateState = () => {
    // Validate the chain's integrity. (This does not enforce team rules - that is done in the
    // reducer as it progresses through each link.)
    const validation = chains.validate(this.chain)
    if (!validation.isValid) throw validation.error

    // Run the chain through the reducer to calculate the current team state
    const resolver = membershipResolver

    // TODO: why ts-ignore here
    //@ts-ignore
    const sequence = chains.getSequence({ chain: this.chain, resolver })
    this.log(chainSummary(this.chain))
    this.state = sequence.reduce(reducer, initialState)

    this.emit('updated', { head: this.chain.head })
  }

  /**************** MEMBERS
  
  */

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

  /** Add a member to the team.
   *
   * **Note:** In most cases this won't be used other than for unit tests.
   * In real-world scenarios, you'll need to use the `team.invite` workflow
   * to add members without relying on some kind of public key infrastructure.
   */
  public add = (user: User, roles: string[] = []) => {
    const member = { ...users.redactUser(user), roles }

    // make lockboxes for the new member
    const lockboxes = this.createMemberLockboxes(member)

    // post the member to the signature chain
    this.dispatch({
      type: 'ADD_MEMBER',
      payload: { member, roles, lockboxes },
    })
  }

  /** Remove a member from the team */
  public remove = (userName: string) => {
    // create new keys & lockboxes for any keys this person had access to
    const lockboxes = this.generateNewLockboxes({ type: MEMBER, name: userName })

    // post the removal to the signature chain
    this.dispatch({
      type: 'REMOVE_MEMBER',
      payload: {
        userName,
        lockboxes,
      },
    })
  }

  private createMemberLockboxes = (member: Member) => {
    const roleKeys = member.roles.map(this.roleKeys)
    const teamKeys = this.teamKeys()
    const createLockbox = (keys: KeysetWithSecrets) => lockbox.create(keys, member.keys)
    return [...roleKeys, teamKeys].map(createLockbox)
  }

  /**************** ROLES
    
  */

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

  /** Add a role to the team */
  public addRole = (role: Role | string) => {
    if (typeof role === 'string') role = { roleName: role }

    // we're creating this role so we need to generate new keys
    const roleKeys = keysets.create({ type: ROLE, name: role.roleName }, this.seed)

    // make a lockbox for the admin role, so that all admins can access this role's keys
    const lockboxForAdmin = lockbox.create(roleKeys, this.adminKeys())

    // post the role to the signature chain
    this.dispatch({
      type: 'ADD_ROLE',
      payload: { ...role, lockboxes: [lockboxForAdmin] },
    })
  }

  /** Remove a role from the team */
  public removeRole = (roleName: string) => {
    if (roleName === ADMIN) throw new Error('Cannot remove admin role.')
    this.dispatch({
      type: 'REMOVE_ROLE',
      payload: { roleName },
    })
  }

  /** Give a member a role */
  public addMemberRole = (userName: string, roleName: string) => {
    // make a lockbox for the role
    const member = this.members(userName)
    const roleLockbox = lockbox.create(this.roleKeys(roleName), member.keys)

    // post the member role to the signature chain
    this.dispatch({
      type: 'ADD_MEMBER_ROLE',
      payload: { userName, roleName, lockboxes: [roleLockbox] },
    })
  }

  /** Remove a role from a member */
  public removeMemberRole = (userName: string, roleName: string) => {
    // TODO: don't allow removing the last admin

    // create new keys & lockboxes for any keys this person had access to via this role
    const lockboxes = this.generateNewLockboxes({ type: ROLE, name: roleName })

    // post the removal to the signature chain
    this.dispatch({
      type: 'REMOVE_MEMBER_ROLE',
      payload: { userName, roleName, lockboxes },
    })
  }

  /**************** DEVICES
    
  */

  public removeDevice = (deviceInfo: DeviceInfo) => {
    const { userName } = deviceInfo
    const deviceId = getDeviceId(deviceInfo)

    // create new keys & lockboxes for any keys this device had access to
    const lockboxes = this.generateNewLockboxes({ type: DEVICE, name: deviceId })

    // post the removal to the signature chain
    this.dispatch({
      type: 'REMOVE_DEVICE',
      payload: {
        userName,
        deviceId,
        lockboxes,
      },
    })
  }

  /**************** INVITATIONS

  Inviting a new member: 

    Alice generates an invitation using a secret seed. The seed an be randomly generated, or
    selected by Alice. Alice sends the invitation to Bob using a trusted channel.

    Meanwhile, Alice adds Bob to the signature chain as a new member, with appropriate roles (if
    any) and any corresponding lockboxes. 

    Bob can't authenticate directly as that member, since it has random temporary keys created by
    Alice. Instead, Bob generates a proof of invitation, and when they try to connect to Alice or
    Charlie they present that proof instead of authenticating.

    Once Alice or Charlie verifies Bob's proof, they send him the team chain. Bob uses that to
    instantiate the team, then he updates the team with his real public keys and adds his current
    device information. 

  Inviting an existing member's device: 

    On his laptop, Bob generates an invitation using a secret seed. He gets that seed to his phone
    using a QR code or by typing it in. 

    On his phone, Bob connects to his laptop (or to Alice or Charlie). Bob's phone presents its
    proof of invitation. 

    Once Bob's laptop or Alice or Charlie verifies Bob's phone's proof, they send it the team chain.
    Using the chain, the phone instantiates the team, then adds itself as a device.

    *Note:* A member can only invite their own devices. A non-admin member can only remove their own
    device; an admin member can remove a device for anyone.
  */

  public invite = (
    userName: string,
    options: { roles?: string[]; invitationSeed?: string } = {}
  ) => {
    const { roles = [] } = options
    let { invitationSeed = invitations.randomSeed() } = options
    invitationSeed = normalize(invitationSeed)

    const currentUser = this.context.user
    if (this.has(userName)) {
      // inviting a device for the current member
      assert(currentUser.userName === userName, `Can't add a device for someone else`)
    } else {
      // inviting a new member
      assert(this.memberIsAdmin(currentUser.userName), `Only admins can add invite new members`)

      // create a new member with random keys; they'll replace those keys as soon as they join
      const tempKeys = keysets.create({ type: keysets.KeyType.MEMBER, name: userName }, invitationSeed)
      const member: Member = { userName, keys: keysets.redactKeys(tempKeys), roles }

      // make normal lockboxes for the new member
      const lockboxes = this.createMemberLockboxes(member)

      // post the member & their lockboxes to the signature chain
      this.dispatch({
        type: 'ADD_MEMBER',
        payload: { member, roles, lockboxes },
      })
    }

    // generate invitation
    const teamKeys = this.teamKeys()
    const invitation = invitations.create({
      invitationSeed,
      teamKeys,
      userName,
      roles,
    })

    // post invitation to signature chain
    this.dispatch({
      type: 'INVITE',
      payload: { invitation },
    })

    // return the secret key (to pass on to invitee) and the invitation id (which they can use to revoke later)
    const { id } = invitation
    return { invitationSeed, id }
  }

  /** Revoke an invitation.  */
  public revokeInvitation = (id: string) => {
    const invitation = this.state.invitations[id]
    if (invitation === undefined) throw new Error(`No invitation with id '${id}' found.`)
    // TODO: should this also remove the member?
    // if the invitation is for an existing member's device, we don't want to
    // otherwise we probably do
    this.dispatch({
      type: 'REVOKE_INVITATION',
      payload: { id },
    })
  }

  /** Returns true if the invitation has ever existed in this team (even if it's been used or revoked) */
  public hasInvitation(id: Hash): boolean
  public hasInvitation(proof: ProofOfInvitation): boolean
  public hasInvitation(proofOrId: Hash | ProofOfInvitation): boolean {
    const id = typeof proofOrId === 'string' ? proofOrId : proofOrId.id
    return id in this.state.invitations
  }

  /** Admit a new member/device to the team based on proof of invitation */
  public admit = (proof: ProofOfInvitation) => {
    const teamKeys = this.teamKeys()
    const { id, userName } = proof

    // make sure this invitation exists and can be used
    const invitation = this.state.invitations[id]

    if (invitation === undefined) throw new Error(`No invitation with id '${id}' found.`)
    if (invitation.revoked === true) throw new Error(`This invitation has been revoked.`)
    if (invitation.used === true) throw new Error(`This invitation has already been used.`)

    // validate proof of invitation
    const validation = invitations.validate(proof, invitation, teamKeys)
    if (validation.isValid === false) throw validation.error

    // post admission to the signature chain
    this.dispatch({
      type: 'ADMIT',
      payload: { id, userName },
    })
  }

  /** Once the new member has received the chain and can instantiate the team, they call this to add
   * their device and change their keys */
  public join = (proof: ProofOfInvitation) => {
    assert(this.hasInvitation(proof), `Can't join a team I wasn't invited to`)

    // q: Am I a new member, or an existing member adding a new device?
    // a: If I don't have any devices registered on the chain, I'm a new member
    const deviceCount = this.members(proof.userName).devices?.length ?? 0
    if (deviceCount === 0) {
      // New member: The signature chain already contains a member entry for me, but it has
      // temporary placeholder keys. Let's update that with my real keys.
      const keys = redactKeys(this.context.user.keys)
      this.dispatch({
        type: 'CHANGE_MEMBER_KEYS',
        payload: { keys },
      })
    }

    // Either way, I add this device
    const device = redactDevice(this.context.user.device)
    this.dispatch({
      type: 'ADD_DEVICE',
      payload: { device },
    })
  }

  /**************** CRYPTO
    
  */

  /**
   * Symmetrically encrypt a payload for the given scope using keys available to the current user.
   *
   * > *Note*: Since this convenience function uses symmetric encryption, we can only use it to
   * encrypt for scopes the current user has keys for (e.g. the whole team, or roles they belong
   * to). If we need to encrypt asymmetrically, we use the functions in the crypto module directly.
   */
  public encrypt = (payload: Payload, roleName?: string): EncryptedEnvelope => {
    const scope = roleName ? { type: ROLE, name: roleName } : TEAM_SCOPE
    const { secretKey, generation } = this.keys(scope)
    return {
      contents: symmetric.encrypt(payload, secretKey),
      recipient: { ...scope, generation },
    }
  }

  /** Decrypt a payload using keys available to the current user. */
  public decrypt = (message: EncryptedEnvelope): string => {
    const { secretKey } = this.keys(message.recipient)
    return symmetric.decrypt(message.contents, secretKey)
  }

  /** Sign a message using the current user's keys. */
  public sign = (payload: Payload): SignedEnvelope => ({
    contents: payload,
    signature: signatures.sign(payload, this.context.user.keys.signature.secretKey),
    author: {
      type: MEMBER,
      name: this.userName,
      generation: this.context.user.keys.generation,
    },
  })

  /** Verify a signed message against the author's public key */
  public verify = (message: SignedEnvelope): boolean =>
    signatures.verify({
      payload: message.contents,
      signature: message.signature,
      publicKey: this.members(message.author.name).keys.signature,
    })

  /**************** KEYS

  These methods all return keysets with secrets, and must be available to the local user. To get
  other members' public keys, look up the member - the `keys` property contains their public keys.
  */

  /**
   * Returns the secret keyset (if available to the current user) for the given type and name. To
   * get other members' public keys, look up the member - the `keys` property contains their public
   * keys.  */
  public keys = (scope: Optional<KeyMetadata, 'generation'>): KeysetWithSecrets =>
    select.keys(this.state, this.context.user, scope)

  /** Returns the team keyset. */
  public teamKeys = (): KeysetWithSecrets => this.keys(TEAM_SCOPE)

  /** Returns the keys for the given role. */
  public roleKeys = (roleName: string): KeysetWithSecrets =>
    this.keys({ type: ROLE, name: roleName })

  /** Returns the admin keyset. */
  public adminKeys = (): KeysetWithSecrets => this.roleKeys(ADMIN)

  /** Replaces the current user or device's secret keyset with the one provided. */
  public changeKeys = (newKeyset: PublicKeyset) => {
    switch (newKeyset.type) {
      case KeyType.MEMBER: {
        assert(newKeyset.name === this.userName, `Can't change another user's secret keys`)
        const oldKeys = this.keys(getScope(newKeyset))
        const generation = oldKeys.generation + 1
        this.dispatch({
          type: 'CHANGE_MEMBER_KEYS',
          payload: { keys: { ...newKeyset, generation } },
        })

        // TODO: After I update my own keys, I'll still be able to open lockboxes with the previous
        // keys. Admins should check on every update for this situation - where I have newer keys
        // than what the lockboxes were made for - and treat my previous generation of keys as
        // compromised, and regenerate the keys I could see & make new lockboxes for everyone
        // accordingly

        break
      }
      case KeyType.DEVICE: {
        assert(newKeyset.name === this.deviceId, `Can't change another device's secret keys`)
        this.dispatch({
          type: 'CHANGE_DEVICE_KEYS',
          payload: { keys: newKeyset },
        })
        break
      }
      default:
        throw new Error('updateKeys can only be used to update local user or device keys')
    }
  }

  private get userName() {
    return this.context.user.userName
  }

  private get deviceId() {
    return getDeviceId(this.context.user.device)
  }

  /**
   * Given a compromised scope (e.g. a member or a role), find all scopes that are visible from that
   * scope, and generates new keys and lockboxes for each of those. Returns all of the new lockboxes
   * in a single array to be posted to the signature chain.
   *
   * You can pass it a scope, or a keyset (which includes the scope information). If you pass a
   * keyset, it will replace the existing keys with these.
   *
   * @param compromised If `compromised` is a keyset, that will become the new keyset for the
   * compromised scope. If it is just a scope, new keys will be randomly generated for that scope.
   */
  private generateNewLockboxes = (compromised: KeyScope | KeysetWithSecrets) => {
    const newKeyset = isKeyset(compromised)
      ? compromised // we're given a keyset - use it as the new keys
      : keysets.create(compromised) // we're just given a scope - generate new keys for it

    // identify all the keys that are indirectly compromised
    const visibleScopes = getVisibleScopes(this.state, compromised)
    const newKeysetsForVisibleScopes = visibleScopes.map(scope => keysets.create(scope))

    // generate new lockboxes for each one
    const allNewKeysets = [newKeyset, ...newKeysetsForVisibleScopes]
    const newLockboxes = allNewKeysets.flatMap(newKeyset => {
      const scope = getScope(newKeyset)
      const oldLockboxes = select.lockboxesInScope(this.state, scope)
      return oldLockboxes.map(oldLockbox => lockbox.rotate(oldLockbox, newKeyset))
    })

    return newLockboxes
  }
}

const maybeDeserialize = (source: string | TeamSignatureChain): TeamSignatureChain =>
  typeof source === 'string' ? chains.deserialize(source) : source
