import * as identity from '@/connection/identity'
import { Challenge } from '@/connection/types'
import { LocalUserContext } from '@/context'
import * as devices from '@/device'
import { getDeviceId, parseDeviceId, Device, redactDevice, DeviceWithSecrets } from '@/device'
import * as invitations from '@/invitation'
import { ProofOfInvitation } from '@/invitation'
import { normalize } from '@/invitation/normalize'
import * as lockbox from '@/lockbox'
import { ADMIN, Role } from '@/role'
import { assert, debug, getScope, Hash, Payload, scopesMatch, UnixTimestamp, VALID } from '@/util'
import { Base58, randomKey, signatures, symmetric } from '@herbcaudill/crypto'
import {
  createKeyset,
  createStore,
  deserialize,
  isKeyset,
  KeyScope,
  Keyset,
  KeysetWithSecrets,
  KeyType,
  redactKeys,
  Store,
  UserWithSecrets,
} from 'crdx'
import EventEmitter from 'events'
import { ADMIN_SCOPE, ALL, initialState, TEAM_SCOPE } from './constants'
import { membershipResolver as resolver } from './membershipResolver'
import { redactUser } from './redactUser'
import { reducer } from './reducer'
import * as select from './selectors'
import {
  EncryptedEnvelope,
  isNewTeam,
  Member,
  SignedEnvelope,
  TeamAction,
  TeamOptions,
  TeamSignatureChain,
  TeamState,
} from './types'

/**
 * The `Team` class wraps a `TeamSignatureChain` and exposes methods for adding and removing
 * members, assigning roles, creating and using invitations, and encrypting messages for
 * individuals, for the team, or for members of specific roles.
 */
export class Team extends EventEmitter {
  private store: Store<TeamState, TeamAction>
  private context: LocalUserContext
  private log: (o: any, ...args: any[]) => void
  private seed: string

  public state: TeamState = initialState
  /**
   * We can make a team instance either by creating a brand-new team, or restoring one from a stored
   * signature chain.
   */
  constructor(options: TeamOptions) {
    super()

    // ignore coverage
    this.seed = options.seed ?? randomKey()
    this.context = options.context

    this.log = debug(`lf:auth:team:${this.userName}`)

    // Initialize a CRDX store for the team
    if (isNewTeam(options)) {
      // Create a new team with the current user as founding member
      const { device, user } = options.context

      // Team & role secrets are never stored in plaintext, only encrypted into individual
      // lockboxes. Here we generate new keysets for the team and for the admin role, and store
      // these in new lockboxes for the founding member
      const teamKeys = createKeyset(TEAM_SCOPE, this.seed)
      const teamLockbox = lockbox.create(teamKeys, user.keys)
      const adminKeys = createKeyset(ADMIN_SCOPE, this.seed)
      const adminLockbox = lockbox.create(adminKeys, user.keys)

      // We also store the user's keys in a lockbox for the user's device
      const deviceLockbox = lockbox.create(user.keys, this.context.device.keys)

      // We're creating a new chain; this information is to be recorded in the root link
      const rootPayload = {
        name: options.teamName,
        rootMember: redactUser(user),
        rootDevice: devices.redactDevice(device),
        lockboxes: [teamLockbox, adminLockbox, deviceLockbox],
      }

      // Create CRDX store
      this.store = createStore({ user, reducer, resolver, initialState, rootPayload })
    } else {
      // Rehydrate a team from an existing chain
      const chain = maybeDeserialize(options.source)
      const { user } = options.context

      // Create CRDX store
      this.store = createStore({ user, reducer, resolver, initialState, chain })
    }

    this.state = this.store.getState()
  }

  public get chain() {
    return this.store.getChain() as TeamSignatureChain
  }

  /**************** TEAM STATE

  All the logic for *reading* team state is in selectors (see `/team/selectors`).

  Most of the logic for *modifying* team state is in transforms (see `/team/transforms`), which are
  executed by the reducer. To mutate team state, we dispatch changes to the signature chain, and
  then run the chain through the reducer to recalculate team state.

  Any crypto operations involving the current user's secrets (for example, opening or creating
  lockboxes, or signing links) are done here, not in the selectors or in the reducer. Only the
  public-facing outputs (for example, the resulting lockboxesInScope, or the signed links) are
  posted on the chain.
  */

  /** Returns this team's user-facing name. */
  public get teamName() {
    return this.state.teamName
  }

  public save = () => this.store.save()

  /**
   * Merges another chain (e.g. from a peer) with ours.
   * @param theirChain The chain to merge with.
   * @returns This `Team` instance.
   */
  public merge = (theirChain: TeamSignatureChain) => {
    this.store.merge(theirChain)
    this.state = this.store.getState()
    this.emit('updated', { head: this.chain.head })
    return this
  }

  /** Add a link to the chain, then recompute team state from the new chain */
  public dispatch(action: TeamAction) {
    this.store.dispatch(action)
    this.state = this.store.getState()
    this.emit('updated', { head: this.chain.head })
  }

  public lookupIdentity = (identityClaim: KeyScope): LookupIdentityResult => {
    assert(identityClaim.type === KeyType.DEVICE) // we always authenticate as devices
    const deviceId = identityClaim.name
    const { userName, deviceName } = parseDeviceId(deviceId)
    if (this.memberWasRemoved(userName)) return 'MEMBER_REMOVED'
    if (!this.has(userName)) return 'MEMBER_UNKNOWN'
    if (this.deviceWasRemoved(userName, deviceName)) return 'DEVICE_REMOVED'
    if (!this.hasDevice(userName, deviceName)) return 'DEVICE_UNKNOWN'
    return 'VALID_DEVICE'
  }

  public verifyIdentityProof = (challenge: Challenge, proof: Base58) => {
    assert(challenge.type === KeyType.DEVICE) // we always authenticate as devices
    const deviceId = challenge.name
    const { userName, deviceName } = parseDeviceId(deviceId)
    const device = this.device(userName, deviceName)
    const validation = identity.verify(challenge, proof, device.keys)
    return validation.isValid
  }

  /**************** MEMBERS */

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
  public add = (user: UserWithSecrets, roles: string[] = [], device?: Device) => {
    const member = { ...redactUser(user), roles }

    // make lockboxes for the new member
    const lockboxes = this.createMemberLockboxes(member)

    // post the member to the signature chain
    this.dispatch({
      type: 'ADD_MEMBER',
      payload: { member, roles, lockboxes },
    })

    if (device) {
      // post the member's device to the signature chain
      const deviceLockbox = lockbox.create(user.keys, device.keys)
      this.dispatch({
        type: 'ADD_DEVICE',
        payload: { device, lockboxes: [deviceLockbox] },
      })
    }
  }

  /** Remove a member from the team */
  public remove = (userName: string) => {
    // create new keys & lockboxes for any keys this person had access to
    const lockboxes = this.generateNewLockboxes({ type: KeyType.USER, name: userName })

    // post the removal to the signature chain
    this.dispatch({
      type: 'REMOVE_MEMBER',
      payload: {
        userName,
        lockboxes,
      },
    })
  }

  /** Returns true if the member was once on the team but was removed */
  public memberWasRemoved = (userName: string) => select.memberWasRemoved(this.state, userName)

  private createMemberLockboxes = (member: Member) => {
    const roleKeys = member.roles.map(this.roleKeys)
    const teamKeys = this.teamKeys()
    const createLockbox = (keys: KeysetWithSecrets) => lockbox.create(keys, member.keys)
    return [...roleKeys, teamKeys].map(createLockbox)
  }

  /**************** ROLES */

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
    const roleKeys = createKeyset({ type: KeyType.ROLE, name: role.roleName }, this.seed)

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
    if (roleName === ADMIN) {
      const adminCount = this.membersInRole(ADMIN).length
      assert(adminCount > 1, `Can't remove the last admin`)
    }

    // create new keys & lockboxes for any keys this person had access to via this role
    const lockboxes = this.generateNewLockboxes({ type: KeyType.ROLE, name: roleName })

    // post the removal to the signature chain
    this.dispatch({
      type: 'REMOVE_MEMBER_ROLE',
      payload: { userName, roleName, lockboxes },
    })
  }

  /**************** DEVICES */

  /** Returns true if the given member has a device by the given name */
  public hasDevice = (userName: string, deviceName: string): boolean =>
    select.hasDevice(this.state, userName, deviceName)

  /** Find a member's device by name */
  public device = (userName: string, deviceName: string): Device =>
    select.device(this.state, userName, deviceName)

  /** Remove a member's device */
  public removeDevice = (userName: string, deviceName: string) => {
    if (!this.hasDevice(userName, deviceName)) return

    // create new keys & lockboxes for any keys this device had access to
    const deviceId = getDeviceId({ userName, deviceName })
    const lockboxes = this.generateNewLockboxes({ type: KeyType.DEVICE, name: deviceId })

    // post the removal to the signature chain
    this.dispatch({
      type: 'REMOVE_DEVICE',
      payload: {
        userName,
        deviceName,
        lockboxes,
      },
    })
  }

  /** Returns true if the device was once on the team but was removed */
  public deviceWasRemoved = (userName: string, deviceName: string) => {
    const deviceId = getDeviceId({ userName, deviceName })
    return select.deviceWasRemoved(this.state, deviceId)
  }

  /**************** INVITATIONS */

  /**
  To invite a new member: 

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
  */
  public inviteMember({
    seed = invitations.randomSeed(),
    expiration,
    maxUses,
  }: {
    /** A secret to be passed to the invitee via a side channel. If not provided, one will be randomly generated. */
    seed?: string

    /** Time when the invitation expires. If not provided, the invitation does not expire. */
    expiration?: UnixTimestamp

    /** Number of times the invitation can be used. If not provided, the invitation can be used any number of times. */
    maxUses?: number
  } = {}): InviteResult {
    // normalize the seed (all lower case, strip spaces & punctuation)
    seed = normalize(seed)

    // generate invitation
    const invitation = invitations.create({ seed, expiration, maxUses })
    const { id } = invitation

    // post invitation to signature chain
    this.dispatch({
      type: 'INVITE_MEMBER',
      payload: { invitation },
    })

    // return the secret invitation seed (to pass on to invitee) and the invitation id (which could be used to revoke later)
    return { id, seed }
  }

  /**
   *  To invite an existing member's device:
   *
   *  On his laptop, Bob generates an invitation using a secret seed. He gets that seed to his phone
   *  using a QR code or by typing it in.
   *
   *  On his phone, Bob connects to his laptop (or to Alice or Charlie). Bob's phone presents its
   *  proof of invitation.
   *
   *  Once an existing device (Bob's laptop or Alice or Charlie) verifies Bob's phone's proof, they
   *  send it the team chain. Using the chain, the phone instantiates the team, then adds itself as
   *  a device.
   *
   *  Note: A member can only invite their own devices. A non-admin member can only remove their own
   *  device; an admin member can remove a device for anyone.
   */
  public inviteDevice({
    seed = invitations.randomSeed(),
    expiration = Date.now() + 30 * 60 * 1000, // 30 minutes
  }: {
    /** A secret to be passed to the device via a side channel. If not provided, one will be randomly generated. */
    seed?: string

    /** Time when the invitation expires. Defaults to 30 minutes from now. */
    expiration?: UnixTimestamp
  } = {}): InviteResult {
    seed = normalize(seed)

    // generate invitation

    const userName = this.userName

    const maxUses = 1 // can't invite multiple devices with the same invitation
    const invitation = invitations.create({ seed, expiration, maxUses, userName })
    const { id } = invitation

    // post invitation to signature chain
    this.dispatch({
      type: 'INVITE_DEVICE',
      payload: { invitation },
    })

    // return the secret invitation seed (to pass on to invitee) and the invitation id (which could be used to revoke later)
    return { id, seed }
  }

  /** Revoke an invitation. */
  public revokeInvitation = (id: string) => {
    // mark the invitation as revoked
    this.dispatch({
      type: 'REVOKE_INVITATION',
      payload: { id },
    })
  }

  /** Returns true if the invitation has ever existed in this team (even if it's been used or revoked) */
  public hasInvitation(id: Hash): boolean
  public hasInvitation(proof: ProofOfInvitation): boolean
  public hasInvitation(proofOrId: Hash | ProofOfInvitation): boolean {
    const id =
      typeof proofOrId === 'string' //
        ? proofOrId // string id was passed
        : proofOrId.id // proof of invitation was passed
    return select.hasInvitation(this.state, id)
  }

  /** Gets the invitation corresponding to the given id. If it does not exist, throws an error. */
  public getInvitation = (id: string) => {
    return select.getInvitation(this.state, id)
  }

  /** Check whether a proof of invitation matches a valid invitation  */
  public validateInvitation = (proof: ProofOfInvitation) => {
    const { id } = proof
    if (!this.hasInvitation(id)) return invitations.fail(`No invitation with id '${id}' found.`)
    const invitation = this.getInvitation(id)

    // make sure the invitation hasn't already been used, hasn't expired, and hasn't been revoked
    const canBeUsedResult = invitations.invitationCanBeUsed(invitation, Date.now())
    if (canBeUsedResult !== VALID) return canBeUsedResult

    // validate the proof of invitation
    return invitations.validate(proof, invitation)
  }

  /** An existing team member calls this to admit a new member & their device to the team based on proof of invitation */
  public admitMember = (
    proof: ProofOfInvitation,
    memberKeys: Keyset | KeysetWithSecrets // we accept KeysetWithSecrets here to simplify testing - in practice we'll only receive Keyset
  ) => {
    const validation = this.validateInvitation(proof)
    if (validation.isValid === false) throw validation.error
    const { id } = proof

    // TODO: make lockbox naming consistent?
    // lockbox_TeamKeysForMember
    // lockbox_UserKeysForDevice
    // lockbox_AdminKeysForMember

    // we know the team keys, so we can put them in a lockbox for the new member now (even if we're not an admin)
    const teamKeysLockbox = lockbox.create(this.teamKeys(), memberKeys)

    // post admission to the signature chain
    this.dispatch({
      type: 'ADMIT_MEMBER',
      payload: {
        id,
        memberKeys: redactKeys(memberKeys),
        lockboxes: [teamKeysLockbox],
      },
    })
  }

  /** A member calls this to admit a new device for themselves based on proof of invitation */
  public admitDevice = (proof: ProofOfInvitation, device: DeviceWithSecrets | Device) => {
    const validation = this.validateInvitation(proof)
    if (validation.isValid === false) throw validation.error
    const { id } = proof
    const { userName, deviceName, keys } = device

    assert(this.context.user)
    assert(this.userName === userName, `Can't admit someone else's device`)

    const deviceLockbox = lockbox.create(this.context.user.keys, keys)

    // post admission to the signature chain
    this.dispatch({
      type: 'ADMIT_DEVICE',
      payload: {
        id,
        userName,
        deviceName,
        deviceKeys: redactKeys(keys),
        lockboxes: [deviceLockbox],
      },
    })
  }

  /** Once the new member has received the chain and can instantiate the team, they call this to add their device. */
  public joinAsMember = () => {
    assert(this.context.user)
    const deviceLockbox = lockbox.create(this.context.user.keys, this.context.device.keys)
    const device = redactDevice(this.context.device)
    this.dispatch({
      type: 'ADD_DEVICE',
      payload: {
        device,
        lockboxes: [deviceLockbox],
      },
    })
  }

  /** Once a new device has received the chain and can instantiate the team, they call this to get the user keys */
  public joinAsDevice = (userName: string) => {
    const user = {
      userName,
      keys: this.keys({ type: KeyType.USER, name: userName }),
    }
    this.store = createStore({ user, reducer, resolver, initialState, chain: this.chain })
    this.context.user = user

    return user
  }

  /**************** CRYPTO */

  /**
   * Symmetrically encrypt a payload for the given scope using keys available to the current user.
   *
   * > *Note*: Since this convenience function uses symmetric encryption, we can only use it to
   * encrypt for scopes the current user has keys for (e.g. the whole team, or roles they belong
   * to). If we need to encrypt asymmetrically, we use the functions in the crypto module directly.
   */
  public encrypt = (payload: Payload, roleName?: string): EncryptedEnvelope => {
    const scope = roleName ? { type: KeyType.ROLE, name: roleName } : TEAM_SCOPE
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
  public sign = (payload: Payload): SignedEnvelope => {
    assert(this.context.user)
    return {
      contents: payload,
      signature: signatures.sign(payload, this.context.user.keys.signature.secretKey),
      author: {
        type: KeyType.USER,
        name: this.userName,
        generation: this.context.user.keys.generation,
      },
    }
  }

  /** Verify a signed message against the author's public key */
  public verify = (message: SignedEnvelope): boolean =>
    signatures.verify({
      payload: message.contents,
      signature: message.signature,
      publicKey: this.members(message.author.name).keys.signature,
    })

  /**************** KEYS

  These methods all return keysets *with secrets* that are available to the local user. To get
  other members' public keys, look up the member - the `keys` property contains their public keys.
  */

  /**
   * Returns the secret keyset (if available to the current device) for the given type and name. To
   * get other members' public keys, look up the member - the `keys` property contains their public
   * keys.  */
  public keys = (scope: KeyScope) => select.keys(this.state, this.context.device, scope)

  /** Returns the team keyset. */
  public teamKeys = () => this.keys(TEAM_SCOPE)

  /** Returns the keys for the given role. */
  public roleKeys = (roleName: string) => this.keys({ type: KeyType.ROLE, name: roleName })

  /** Returns the admin keyset. */
  public adminKeys = () => this.roleKeys(ADMIN)

  /** Replaces the current user or device's secret keyset with the one provided.
   * (This can also be used by an admin to change another user's secret keyset.)
   */
  public changeKeys = (newKeys: KeysetWithSecrets) => {
    const changingDeviceKeys = newKeys.type === KeyType.DEVICE

    // make sure we're allowed to change these keys
    if (!changingDeviceKeys) {
      // user keys
      assert(this.context.user)
      const changingMyOwnKeys = newKeys.name === this.userName
      const iAmAdmin = this.memberIsAdmin(this.userName)
      assert(changingMyOwnKeys || iAmAdmin, `Can't change another user's secret keys`)
    } else {
      // device keys
      const changingMyOwnKeys = newKeys.name === this.deviceId
      assert(changingMyOwnKeys, `Can't change another device's secret keys`)
    }

    const userOrDevice = changingDeviceKeys ? this.context.device : this.context.user!
    const oldKeys = userOrDevice.keys
    newKeys.generation = oldKeys.generation + 1

    // treat the old keys as compromised, and rotate any lockboxes they could open
    const lockboxes = this.generateNewLockboxes(newKeys)

    // post our new public keys to the signature chain
    const type = changingDeviceKeys ? 'CHANGE_DEVICE_KEYS' : 'CHANGE_MEMBER_KEYS'
    const keys = redactKeys(newKeys)
    this.dispatch({ type, payload: { keys, lockboxes } })

    // update our member or device keys in context
    userOrDevice.keys = newKeys
  }

  public get userName() {
    if (this.context.user) return this.context.user.userName
    else return this.context.device.userName // device is always known
  }

  private get deviceId() {
    return getDeviceId(this.context.device)
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
      : createKeyset(compromised) // we're just given a scope - generate new keys for it

    // identify all the keys that are indirectly compromised
    const visibleScopes = select.getVisibleScopes(this.state, compromised)
    const otherNewKeysets = visibleScopes.map(scope => createKeyset(scope))

    // generate new keys for each one
    const newKeysets = [newKeyset, ...otherNewKeysets]

    // create new lockboxes for each of these
    const newLockboxes = newKeysets.flatMap(newKeyset => {
      const scope = getScope(newKeyset)
      const oldLockboxes = select.lockboxesInScope(this.state, scope)

      return oldLockboxes.map(oldLockbox => {
        // check whether we have new keys for the recipient of this lockbox
        const updatedKeyset = newKeysets.find(k => scopesMatch(k, oldLockbox.recipient))
        return lockbox.rotate({
          oldLockbox,
          newContents: newKeyset,
          // if we did, address the new lockbox to those keys
          updatedRecipientKeys: updatedKeyset ? redactKeys(updatedKeyset) : undefined,
        })
      })
    })

    return newLockboxes
  }
}

const maybeDeserialize = (source: string | TeamSignatureChain): TeamSignatureChain =>
  typeof source === 'string' ? deserialize(source) : source

type InviteResult = {
  /** The unique identifier for this invitation. */
  id: string

  /** The secret invitation key. (Returned in case it was generated randomly.) */
  seed: string
}

type LookupIdentityResult =
  | 'VALID_DEVICE'
  | 'MEMBER_UNKNOWN'
  | 'MEMBER_REMOVED'
  | 'DEVICE_UNKNOWN'
  | 'DEVICE_REMOVED'
