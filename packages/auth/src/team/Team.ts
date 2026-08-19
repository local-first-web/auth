import { EventEmitter } from '@herbcaudill/eventemitter42'
import type {
  Hash,
  KeyMetadata,
  KeyScope,
  Keyring,
  Keyset,
  KeysetWithSecrets,
  Payload,
  Store,
  UnixTimestamp,
  UserWithSecrets,
} from '@localfirst/crdx'
import {
  createKeyring,
  createKeyset,
  createStore,
  getLatestGeneration,
  isKeyset,
  redactKeys,
} from '@localfirst/crdx'
import { randomKey, signatures, symmetric, type Base58 } from '@localfirst/crypto'
import { assert, debug } from '@localfirst/shared'
import * as identity from '../connection/identity.js'
import { type Challenge } from '../connection/types.js'
import * as devices from '../device/index.js'
import { redactDevice, type Device } from '../device/index.js'
import * as invitations from '../invitation/index.js'
import { type ProofOfInvitation } from '../invitation/index.js'
import { InvitationValidationError } from '../invitation/validate.js'
import { normalize } from '../invitation/normalize.js'
import * as lockbox from '../lockbox/index.js'
import { ADMIN, type Role } from '../role/index.js'
import { castServer } from '../server/castServer.js'
import { type Host, type Server } from '../server/types.js'
import { type LocalUserContext } from './context.js'
import { KeyType, VALID, scopesMatch } from '../util/index.js'
import { auditAuthorship } from './auditAuthorship.js'
import { isRegisteredEncryptionKey } from './registeredEncryptionKeys.js'
import { keyHistoryKey } from './transforms/collectLockboxes.js'
import { assertLinksAreWellFormed, payloadProblem } from './checkPayload.js'
import { ADMIN_SCOPE, ALL, TEAM_SCOPE, initialState } from './constants.js'
import { membershipResolver as resolver } from './membershipResolver.js'
import { redactUser } from './redactUser.js'
import { reducer } from './reducer.js'
import * as select from './selectors/index.js'
import { maybeDeserialize, serializeTeamGraph } from './serialize.js'
import type {
  EncryptedEnvelope,
  InviteResult,
  Member,
  SignedEnvelope,
  TeamAction,
  TeamGraph,
  TeamOptions,
  TeamState,
} from './types.js'
import { isNewTeam } from './types.js'

const { DEVICE, USER } = KeyType
/**
 * The `Team` class wraps a `TeamGraph` and exposes methods for adding and removing
 * members, assigning roles, creating and using invitations, and encrypting messages for
 * individuals, for the team, or for members of specific roles.
 */
export class Team extends EventEmitter<TeamEvents> {
  public state: TeamState = initialState

  private readonly store: Store<TeamState, TeamAction>
  private readonly context: LocalUserContext
  private readonly log: (o: any, ...args: any[]) => void
  private readonly seed: string

  /**
   * We can make a team instance either by creating a brand-new team, or restoring one from a stored graph.
   */
  constructor(options: TeamOptions) {
    super()

    // ignore coverage
    this.seed = options.seed ?? randomKey()

    if ('user' in options.context) {
      this.context = options.context
    } else {
      // If we're on a server, we'll use the server's hostname for everything
      // and the server's keys as both user keys and device keys
      const { server } = options.context
      this.context = {
        ...options.context,
        device: castServer.toDevice(server),
        user: castServer.toUser(server),
      }
    }
    const { device, user } = this.context

    this.log = debug.extend(`auth:team:${this.userName}`)

    // Initialize a CRDX store for the team
    if (isNewTeam(options)) {
      // Create a new team with the current user as founding member

      assert(!this.isServer, `Servers can't create teams`)

      // Team & role secrets are never stored in plaintext, only encrypted into individual
      // lockboxes. Here we generate new keysets for the team and for the admin role, and store
      // these in new lockboxes for the founding member
      const lockboxTeamKeysForMember = lockbox.create(options.teamKeys, user.keys)
      const adminKeys = createKeyset(ADMIN_SCOPE, this.seed)
      const lockboxAdminKeysForMember = lockbox.create(adminKeys, user.keys)

      // We also store the founding user's keys in a lockbox for the user's device
      const lockboxUserKeysForDevice = lockbox.create(user.keys, this.context.device.keys)

      // We're creating a new graph; this information is to be recorded in the root link
      const rootPayload = {
        name: options.teamName,
        rootMember: redactUser(user),
        rootDevice: devices.redactDevice(device),
        lockboxes: [lockboxTeamKeysForMember, lockboxAdminKeysForMember, lockboxUserKeysForDevice],
      }

      // Create CRDX store
      this.store = createStore({
        user,
        reducer,
        resolver,
        initialState,
        rootPayload,
        keys: options.teamKeys,
      })
    } else {
      // Rehydrate a team from an existing graph
      // Create CRDX store
      const graph = maybeDeserialize(options.source, options.teamKeyring)

      // A team is most often loaded from a graph someone else sent us, so this is the same door as
      // `merge`
      assertLinksAreWellFormed(graph)

      this.store = createStore({
        user,
        reducer,
        resolver,
        initialState,
        graph,
        keys: options.teamKeyring,
      })
    }

    this.state = this.store.getState()
    this.updateUserKeys()

    // Wire up event listeners
    this.on('updated', () => {
      this.updateUserKeys()

      // If we're admin, check for pending key rotations
      this.checkForPendingKeyRotations()
    })
  }

  /** ************** PUBLIC API */

  public get graph() {
    return this.store.getGraph() as TeamGraph
  }

  /** We use the hash of the graph's root as a unique ID for the team. */
  public get id() {
    return this.graph.root as Base58
  }

  /** Returns this team's user-facing name. */
  public get teamName() {
    return this.state.teamName
  }

  public setTeamName(teamName: string) {
    this.dispatch({ type: 'SET_TEAM_NAME', payload: { teamName } })
  }

  /** ************** CONTEXT */

  public get userName() {
    return this.context.user.userId
  }

  public get userId() {
    return this.context.user.userId
  }

  private get isServer() {
    return 'server' in this.context
  }

  /** ************** TEAM STATE
   *
   * All the logic for *reading* team state is in selectors (see `/team/selectors`).
   *
   * Most of the logic for *modifying* team state is in transforms (see `/team/transforms`), which
   * are executed by the reducer. To mutate team state, we dispatch changes to the graph, and then
   * run the graph through the reducer to recalculate team state.
   *
   * Any crypto operations involving the current user's secrets (for example, opening or creating
   * lockboxes, or signing links) are done here, not in the selectors or in the reducer. Only the
   * public-facing outputs (for example, the resulting lockboxesInScope, or the signed links) are
   * posted on the graph.
   */

  public save = () => serializeTeamGraph(this.graph)

  /**
   * Reports any links on this team's chain whose stated author doesn't match the key that actually
   * encrypted them. An empty array means every link was authored by the member it's attributed to.
   */
  public auditAuthorship = () => auditAuthorship(this.graph, this.state)

  /**
   * Reports what CRDX's validators make of this team's graph. That's three rules about the graph's
   * shape — each link's hash matches its bytes, the links its `prev` names exist, and the ROOT link
   * is the graph's root — plus the two advisory rules about timestamps described below. Before any
   * of those run, `runValidators` checks the graph's own bookkeeping: that `root` and each `head`
   * name a link whose bytes hash to that name, and that there are as many encrypted links as links
   * (a count, not a correspondence — a graph with the right number of them under the wrong hashes
   * gets past it, and `validateHash` is what catches that). A failure there comes back through here
   * as an ordinary invalid result, with one exception: if a head's encrypted link is missing
   * outright, that check throws rather than returning, so it reaches you as an exception. That's
   * auth-xd2.
   *
   * Note what isn't in that list: CRDX doesn't verify signatures, here or anywhere. A link's stated
   * author is checked against the key that actually encrypted it by `linkAuthorshipIsAuthentic`,
   * which runs during replay, not here; `Team.auditAuthorship` reports on it after the fact. Nor
   * does this re-run the team's own membership rules — who may add whom, who may change whose keys.
   * Those are applied as the graph is replayed, on load and on every merge and dispatch, so a team
   * whose state you can read has already been through them. A valid answer from this method is not
   * a statement about any of that.
   *
   * The advisory rules are why this exists, since they're reported rather than enforced, and the
   * two of them want different things from a caller:
   *
   * - `validateTimestampNotInFuture` fails on a link stamped later than this device's clock. That
   *   resolves itself: the peer who wrote it is a few minutes fast, and once our clock passes the
   *   timestamp the same graph validates.
   * - `validateTimestampOrder` fails on a link older than a link it descends from, which is what
   *   merging a fast peer and then appending on a correct clock produces. Nothing repairs that —
   *   the graph can't change, and no amount of waiting helps. Don't treat it as transient skew.
   *
   * Two more things to know about the answer: it's the first failure found rather than a list of
   * them, and it's computed fresh on each call, so asking again after the clock moves is
   * meaningful.
   */
  public validate = () => this.store.validate()

  /**
   * Merges another graph (e.g. from a peer) with ours.
   * @returns This `Team` instance.
   */
  public merge = (theirGraph: TeamGraph) => {
    // Whatever a peer sends us has to be something we can replay. This is the door: the resolver
    // walks payloads before anything validates them, and links it discards go to
    // `invalidLinkReducer` instead of to the validators — so the shape is settled here, once,
    // rather than by each of them.
    assertLinksAreWellFormed(theirGraph, this.graph.links)

    this.store.merge(theirGraph)
    this.state = this.store.getState()

    this.emit('updated', { head: this.graph.head })
    return this
  }

  /** Add a link to the graph, then recompute team state from the new graph */
  public dispatch(action: TeamAction, teamKeys: KeysetWithSecrets = this.teamKeys()) {
    // A link is appended to the graph before the reducer ever sees it, so a payload the validators
    // would refuse has to be caught here as well: refused on replay, it would leave a link on the
    // graph that nobody — including us — could ever replay again. `payloadsMustBeWellFormed`
    // applies this same rule to links that arrive from anywhere else.
    const problem = payloadProblem(action)
    assert(problem === undefined, problem)

    this.store.dispatch(action, teamKeys)
    this.state = this.store.getState()

    this.emit('updated', { head: this.graph.head })
  }

  /** ************** MEMBERS */

  /** Returns true if the team has a member with the given userId */
  public has = (userId: string) => select.hasMember(this.state, userId)

  /** Returns a list of all members on the team */
  public members(): Member[] // Overload: all members
  /** Returns the member with the given user name */
  public members(userId: string, options?: LookupOptions): Member // Overload: one member
  //
  public members(userId: string = ALL, options = { includeRemoved: true }): Member | Member[] {
    return userId === ALL //
      ? this.state.members // All members
      : select.member(this.state, userId, options) // One member
  }

  /**
   * Adds a member to the team, along with an (optional) device. Since this method assumes that you
   * know the member's secret keys, it only makes sense for unit tests. In real-world scenarios,
   * you'll need to use the `team.invite` workflow to add members without relying on some kind of
   * public key infrastructure.
   *
   * This can be used to add a device for an existing member - just pass the existing user as the
   * first argument.
   */
  public addForTesting = (user: UserWithSecrets, roles: string[] = [], device?: Device) => {
    const member = { ...redactUser(user), roles }

    if (!this.has(member.userId)) {
      // Make lockboxes for the new member
      const lockboxes = this.createMemberLockboxes(member)

      // Post the member to the graph
      this.dispatch({
        type: 'ADD_MEMBER',
        payload: { member, roles, lockboxes },
      })
    }

    if (device) {
      // Post the member's device to the graph
      const lockboxUserKeysForDevice = lockbox.create(user.keys, device.keys)
      this.dispatch({
        type: 'ADD_DEVICE',
        payload: { device, lockboxes: [lockboxUserKeysForDevice] },
      })
    }
  }

  /** Remove a member from the team */
  public remove = (userId: string) => {
    // Create new keys & lockboxes for any keys this person had access to
    const lockboxes = this.rotateKeys({ type: USER, name: userId })

    // Post the removal to the graph
    this.dispatch({
      type: 'REMOVE_MEMBER',
      payload: {
        userId,
        lockboxes,
      },
    })
  }

  /** Returns true if the member was once on the team but was removed */
  public memberWasRemoved = (userId: string) => select.memberWasRemoved(this.state, userId)

  /** ************** ROLES */

  /** Returns all roles in the team */
  public roles(): Role[]
  /** Returns the role with the given name */
  public roles(roleName: string): Role
  //
  public roles(roleName: string = ALL): Role | Role[] {
    return roleName === ALL //
      ? this.state.roles // All roles
      : select.role(this.state, roleName) // One role
  }

  /** Returns true if the member with the given userId has the given role */
  public memberHasRole = (userId: string, roleName: string) =>
    select.memberHasRole(this.state, userId, roleName)

  /** Returns true if the member with the given userId is a member of the 3 role */
  public memberIsAdmin = (userId: string) => select.memberIsAdmin(this.state, userId)

  /** Returns true if the team has a role with the given name */
  public hasRole = (roleName: string) => select.hasRole(this.state, roleName)

  /** Returns a list of members who have the given role */
  public membersInRole = (roleName: string): Member[] => select.membersInRole(this.state, roleName)

  /** Returns a list of members who are in the admin role */
  public admins = (): Member[] => select.admins(this.state)

  /** Add a role to the team */
  public addRole = (role: Role | string) => {
    if (typeof role === 'string') {
      role = { roleName: role }
    }

    // We're creating this role so we need to generate new keys
    const roleKeys = createKeyset({ type: KeyType.ROLE, name: role.roleName }, this.seed)

    // Make a lockbox for the admin role, so that all admins can access this role's keys
    const lockboxRoleKeysForAdmins = lockbox.create(roleKeys, this.adminKeys())

    // Post the role to the graph
    this.dispatch({
      type: 'ADD_ROLE',
      payload: { ...role, lockboxes: [lockboxRoleKeysForAdmins] },
    })
  }

  /** Remove a role from the team */
  public removeRole = (roleName: string) => {
    assert(roleName !== ADMIN, 'Cannot remove admin role')

    this.dispatch({
      type: 'REMOVE_ROLE',
      payload: { roleName },
    })
  }

  /** Give a member a role */
  public addMemberRole = (userId: string, roleName: string) => {
    // Make a lockbox for the role
    const member = this.members(userId)
    const lockboxRoleKeysForMember = lockbox.create(this.roleKeys(roleName), member.keys)

    // Post the member role to the graph
    this.dispatch({
      type: 'ADD_MEMBER_ROLE',
      payload: { userId, roleName, lockboxes: [lockboxRoleKeysForMember] },
    })
  }

  /** Remove a role from a member */
  public removeMemberRole = (userId: string, roleName: string) => {
    if (roleName === ADMIN) {
      const adminCount = this.membersInRole(ADMIN).length
      assert(adminCount > 1, "Can't remove the last admin")
    }

    // Create new keys & lockboxes for any keys this person had access to via this role
    const lockboxes = this.rotateKeys({ type: KeyType.ROLE, name: roleName })

    // Post the removal to the graph
    this.dispatch({
      type: 'REMOVE_MEMBER_ROLE',
      payload: { userId, roleName, lockboxes },
    })
  }

  /** ************** DEVICES */

  /** Returns true if the given member has a device by the given name */
  public hasDevice = (deviceId: string, options?: LookupOptions): boolean =>
    select.hasDevice(this.state, deviceId, options)

  /** Find a member's device by name */
  public device(deviceId: string, options?: LookupOptions): Device {
    return select.device(this.state, deviceId, options)
  }

  /** Remove a member's device */
  public removeDevice = (deviceId: string) => {
    if (!this.hasDevice(deviceId)) throw new Error(`Device ${deviceId} not found`)

    // Create new keys & lockboxes for any keys this device had access to
    const lockboxes = this.rotateKeys({ type: DEVICE, name: deviceId })

    // Post the removal to the graph
    this.dispatch({
      type: 'REMOVE_DEVICE',
      payload: {
        deviceId,
        lockboxes,
      },
    })
  }

  /** Returns true if the device was once on the team but was removed */
  public deviceWasRemoved = (deviceId: string) => {
    return select.deviceWasRemoved(this.state, deviceId)
  }

  /** Looks for a member that has this device. If none is found, return  */
  public memberByDeviceId = (deviceId: string, options?: LookupOptions) => {
    return select.memberByDeviceId(this.state, deviceId, options)
  }

  public verifyIdentityProof = (challenge: Challenge, proof: Base58) => {
    assert(challenge.type === DEVICE) // We always authenticate as devices
    const deviceId = challenge.name

    const device = this.hasServer(deviceId)
      ? this.servers(deviceId)
      : this.device(deviceId, { includeRemoved: true })

    const validation = identity.verify(challenge, proof, device.keys)
    return validation.isValid
  }

  /** ************** INVITATIONS */

  /**
   * To invite a new member:
   *
   * Alice generates an invitation using a secret seed. The seed an be randomly generated, or
   * selected by Alice. Alice sends the invitation to Bob using a trusted channel.
   *
   * Meanwhile, Alice adds Bob to the graph as a new member, with appropriate roles (if
   * any) and any corresponding lockboxes.
   *
   * Bob can't authenticate directly as that member, since it has random temporary keys created by
   * Alice. Instead, Bob generates a proof of invitation, and when they try to connect to Alice or
   * Charlie they present that proof instead of authenticating.
   *
   * Once Alice or Charlie verifies Bob's proof, they send him the team graph. Bob uses that to
   * instantiate the team, then he updates the team with his real public keys and adds his current
   * device information.
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

    /** Number of times the invitation can be used. Defaults to 1; if 0, the invitation can be used any number of times. */
    maxUses?: number
  } = {}): InviteResult {
    // Normalize the seed (all lower case, strip spaces & punctuation)
    seed = normalize(seed)

    // Generate invitation
    const invitation = invitations.create({ kind: 'MEMBER', seed, expiration, maxUses })
    const { id } = invitation

    // The id is derived from the seed, so a seed that's been used before names an invitation the
    // team already has. Posting it again would be refused by `invitationsCanOnlyBePostedOnce` — but
    // a refused link is appended to the graph before the reducer ever sees it, so the refusal would
    // leave a graph that neither we nor any peer could replay again. Say so before dispatching
    // anything. (`normalize` strips everything but letters and digits, so 'Alpha-Bravo' and
    // 'AlphaBravo' are the same seed.)
    assert(
      !this.hasInvitation(id),
      `This invitation seed has already been used on this team (invitation '${id}'). Use a different seed.`
    )

    // Post invitation to graph
    this.dispatch({
      type: 'INVITE_MEMBER',
      payload: { invitation },
    })

    // Return the secret invitation seed (to pass on to invitee) and the invitation id (which could be used to revoke later)
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
   *  send it the team graph. Using the graph, the phone instantiates the team, then adds itself as
   *  a device.
   */
  public inviteDevice({
    seed = invitations.randomSeed(),
    expiration = (Date.now() + 30 * 60 * 1000) as UnixTimestamp,
  }: {
    /** A secret to be passed to the device via a side channel. If not provided, one will be randomly generated. */
    seed?: string

    /** Time when the invitation expires. Defaults to 30 minutes from now. */
    expiration?: UnixTimestamp
  } = {}): InviteResult {
    assert(!this.isServer, "Servers can't invite a device")

    seed = normalize(seed)

    // Generate invitation
    const maxUses = 1 // Can't invite multiple devices with the same invitation
    const invitation = invitations.create({
      kind: 'DEVICE',
      seed,
      expiration,
      maxUses,
      userId: this.userId,
    })

    // In order for the invited device to be able to access the user's keys, we put the user keys in
    // lockboxes that can be opened by an ephemeral keyset generated from the secret invitation seed.
    const starterKeys = invitations.generateStarterKeys(seed)
    const allUserKeys = Object.values(this.userKeyring())
    const lockboxes = allUserKeys.map(keys => lockbox.create(keys, starterKeys))

    const { id } = invitation

    // The id is derived from the seed, so a seed that's been used before names an invitation the
    // team already has. Posting it again would be refused by `invitationsCanOnlyBePostedOnce` — but
    // a refused link is appended to the graph before the reducer ever sees it, so the refusal would
    // leave a graph that neither we nor any peer could replay again. Say so before dispatching
    // anything. (`normalize` strips everything but letters and digits, so 'Alpha-Bravo' and
    // 'AlphaBravo' are the same seed.)
    assert(
      !this.hasInvitation(id),
      `This invitation seed has already been used on this team (invitation '${id}'). Use a different seed.`
    )

    // Post invitation to graph
    this.dispatch({
      type: 'INVITE_DEVICE',
      payload: { invitation, lockboxes },
    })

    // Return the secret invitation seed (to pass on to invitee) and the invitation id (which could be used to revoke later)
    return { id, seed }
  }

  /** Revoke an invitation. */
  public revokeInvitation = (id: string) => {
    // Mark the invitation as revoked
    this.dispatch({
      type: 'REVOKE_INVITATION',
      payload: { id },
    })
  }

  /** Returns true if the invitation has ever existed in this team (even if it's been used or revoked) */
  public hasInvitation(id: Base58): boolean {
    return select.hasInvitation(this.state, id)
  }

  /** Gets the invitation corresponding to the given id. If it does not exist, throws an error. */
  public getInvitation = (id: Base58) => select.getInvitation(this.state, id)

  /** Check whether (1) the invitation is still valid, and (2) the proof of invitation checks out. */
  public validateInvitation = (proof: ProofOfInvitation) => {
    const { id } = proof
    if (!this.hasInvitation(id)) return invitations.fail("This invitation code doesn't match.")

    const invitation = this.getInvitation(id)

    // Make sure the invitation hasn't already been used (in general, or on this invitee in
    // particular), hasn't expired, and hasn't been revoked. This mirrors what the validators will
    // say when the link is replayed; doing it here means the caller gets it as a result rather than
    // as a ValidationError thrown from the middle of `dispatch`.
    const canBeUsedResult = invitations.invitationCanBeUsed(invitation, Date.now(), proof.invitee)
    if (canBeUsedResult !== VALID) return canBeUsedResult

    // Validate the proof of invitation
    return invitations.validate(proof, invitation)
  }

  /** Check if userId and userName are not used by any other member within the team. */
  public validateUser = (userId: string, userName: string) => {
    const memberWithSameUserId = this.members().find(member => member.userId === userId)
    if (memberWithSameUserId !== undefined) {
      return invitations.fail('userId is not unique within the team.')
    }

    const memberWithSameUserName = this.members().find(
      member => member.userName.toLowerCase() === userName.toLowerCase()
    )
    if (memberWithSameUserName !== undefined) {
      return invitations.fail('Username is not unique within the team.')
    }

    return VALID
  }

  /** An existing team member calls this to admit a new member & their device to the team based on proof of invitation */
  public admitMember = (
    proof: ProofOfInvitation,
    memberKeys: Keyset | KeysetWithSecrets, // We accept KeysetWithSecrets here to simplify testing - in practice we'll only receive Keyset
    userName: string // The new member's desired user-facing name
  ) => {
    const invitationValidation = this.validateInvitation(proof)
    if (!invitationValidation.isValid) throw invitationValidation.error

    if (this.getInvitation(proof.id).kind !== 'MEMBER') {
      throw new InvitationValidationError(
        "This is a device invitation, so it can't be used to admit a member."
      )
    }

    // The proof is bound to a single userId; we can only admit the keys it names
    if (proof.invitee !== memberKeys.name) {
      throw new InvitationValidationError('This invitation was issued to a different user.')
    }

    // ...and to the keyset the invitee chose, so we can't substitute one of our own
    if (proof.keyHash !== invitations.hashKeys(memberKeys)) {
      throw new InvitationValidationError(
        'This proof of invitation commits to a different keyset than the one being admitted.'
      )
    }

    // A member is indexed by their userName as well as their userId, and a link that names an
    // unusable one is refused by `payloadsMustBeWellFormed` — which would leave this graph with a
    // link on it that nobody can replay. Say so before dispatching anything.
    assert(
      typeof userName === 'string' && userName.length > 0,
      `'${String(userName)}' is not a usable userName.`
    )

    const userValidation = this.validateUser(memberKeys.name, userName)
    if (!userValidation.isValid) throw userValidation.error

    const { id } = proof

    // we know the team keys, so we can put them in lockboxes for the new member now (even if we're not an admin)
    const allTeamKeys = Object.values(this.teamKeyring())
    const lockboxes = allTeamKeys.map(keys => lockbox.create(keys, memberKeys))

    // Post admission to the graph
    this.dispatch({
      type: 'ADMIT_MEMBER',
      payload: {
        id,
        userName,
        memberKeys: redactKeys(memberKeys),
        proof,
        lockboxes,
      },
    })
  }

  /** An existing team member calls this to admit a new device based on proof of invitation */
  public admitDevice = (proof: ProofOfInvitation, firstUseDevice: devices.FirstUseDevice) => {
    const validation = this.validateInvitation(proof)
    if (!validation.isValid) throw validation.error

    // The proof is bound to a single deviceId; we can only admit the device it names
    if (proof.invitee !== firstUseDevice.deviceId) {
      throw new InvitationValidationError('This invitation was issued to a different device.')
    }

    // ...and to the keyset the device chose, so we can't substitute one of our own
    if (proof.keyHash !== invitations.hashKeys(firstUseDevice.keys)) {
      throw new InvitationValidationError(
        'This proof of invitation commits to a different keyset than the one being admitted.'
      )
    }

    const { id } = proof
    const invitation = this.getInvitation(id)
    if (invitation.kind !== 'DEVICE') {
      throw new InvitationValidationError(
        "This is a member invitation, so it can't be used to admit a device."
      )
    }

    const { userId } = invitation

    // Now we can add the userId to the device and post it to the graph
    const device: Device = { ...firstUseDevice, userId }

    // Post admission to the graph
    this.dispatch({
      type: 'ADMIT_DEVICE',
      payload: {
        id,
        device,
        proof,
      },
    })
  }

  /** Once the new member has received the graph and can instantiate the team, they call this to add their device. */
  public join = (teamKeyring: Keyring, userKeyring = createKeyring(this.context.user.keys)) => {
    assert(!this.isServer, "Can't join as member on server")

    const { device } = this.context
    const teamKeys = getLatestGeneration(teamKeyring)

    // Create a lockbox for each generation of user keys
    const lockboxes = Object.values(userKeyring).map(keys => lockbox.create(keys, device.keys))

    this.dispatch(
      {
        type: 'ADD_DEVICE',
        payload: {
          device: redactDevice(device),
          lockboxes,
        },
      },
      teamKeys
    )
  }

  /** ************** SERVERS */

  /**
   * A server is an always-on, always-connected device that is available to the team but does not
   * belong to any one member. For example, `automerge-repo` calls this a "sync server".
   *
   * A server has a host name that uniquely identifies it (e.g. `example.com`, `localhost:8080`, or
   * `188.26.221.135`).
   *
   * The expected usage is for the application to add a server or servers immediately after the team
   * is created. However, the application can add or remove servers at any time.
   *
   * Just before adding a server, the application should send it the latest graph and the team keys
   * (so it can decrypt the team graph). No invitation or authentication is necessary in this phase,
   * as a TLS connection to a trusted address is sufficient to ensure the security of that
   * connection. In response, the server should send back its public keys. This library is not
   * involved in that process.
   *
   * The application should then add the server to the team using `addServer`, passing in the
   * server's public keys. At that point the server will be able to authenticate with other devices
   * using the same protocol as for members.
   *
   * The only actions that a server can dispatch to the graph are `ADMIT_MEMBER` and `ADMIT_DEVICE`.
   * The server needs to be able to admit invited members and devices in order to support
   * star-shaped networks where every device connects to a server, rather than directly to each
   * other.) This is enforced by the `serversCanOnlyAdmit` validator, so a server can't author other
   * kinds of link under its own name. In particular a server can't rotate its own keys, and there
   * is no action for anyone else to do it on its behalf: to re-key a server, an admin removes it
   * and adds it back with new keys, which rotates the team keys it could see.
   *
   * Note that this is a limit on what a server can do AS ITSELF. What keeps it from simply admitting
   * an invitee under keys it holds, and then acting as that member, is that the invitee's proof of
   * invitation commits to their own keyset (see `admissionMustBeProven`) — a server relaying a
   * genuine proof can admit the invitee, but only under the keys the invitee chose.
   */
  public addServer = (server: Server) => {
    const lockboxes = this.createMemberLockboxes(castServer.toMember(server))

    this.dispatch({
      type: 'ADD_SERVER',
      payload: { server, lockboxes },
    })
  }

  /**
   * Removes a server from the team.
   *
   * A server is given the team keys so it can decrypt the graph, so removing it means rotating
   * those keys — just as removing a member does. Otherwise the ex-server keeps reading everything
   * the team writes from here on.
   */
  public removeServer = (host: string) => {
    // Create new keys & lockboxes for any keys this server had access to
    const lockboxes = this.rotateKeys({ type: KeyType.SERVER, name: host })

    this.dispatch({
      type: 'REMOVE_SERVER',
      payload: { host, lockboxes },
    })
  }

  /** Returns a list of all servers on the team. */
  public servers(): Server[] // Overload: all servers
  /** Returns the server with the given host */
  public servers(host: Host, options?: { includeRemoved: boolean }): Server // Overload: one server
  //
  public servers(
    host: Host = ALL, //
    options = { includeRemoved: true }
  ) {
    return host === ALL //
      ? this.state.servers // All servers
      : select.server(this.state, host, options) // One server
  }

  /** Returns true if the server was once on the team but was removed */
  public serverWasRemoved = (host: Host) => select.serverWasRemoved(this.state, host)

  public hasServer = (host: Host) => select.hasServer(this.state, host)

  /** ************** MESSAGES */

  public addMessage = (message: unknown) => {
    this.dispatch({
      type: 'MESSAGE',
      payload: { message },
    })
  }

  public messages = <T = unknown>() => select.messages(this.state) as T[]

  /** ************** CRYPTO */

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
      contents: symmetric.encryptBytes(payload, secretKey),
      recipient: { ...scope, generation },
    }
  }

  /** Decrypt a payload using keys available to the current user. */
  public decrypt = (message: EncryptedEnvelope): Payload => {
    const { secretKey } = this.keys(message.recipient)
    return symmetric.decryptBytes(message.contents, secretKey)
  }

  /** Sign a message using the current user's keys. */
  public sign = (contents: Payload): SignedEnvelope => {
    assert(this.context.user)
    const {
      keys: {
        type,
        name,
        generation,
        signature: { secretKey },
      },
    } = this.context.user

    return {
      contents,
      signature: signatures.sign(contents, secretKey),
      author: { type, name, generation },
    }
  }

  /** Verify a signed message against the author's public key */
  public verify = (message: SignedEnvelope): boolean =>
    signatures.verify({
      payload: message.contents,
      signature: message.signature,
      publicKey: this.members(message.author.name).keys.signature,
    })

  /** ************** KEYS
   *
   * These methods all return keysets *with secrets* that are available to the local user. To get
   * other members' public keys, look up the member - the `keys` property contains their public keys.
   */

  /**
   * Returns the secret keyset (if available to the current device) for the given type and name. To
   * get other members' public keys, look up the member - the `keys` property contains their public
   * keys.
   */
  public keys = (scope: KeyMetadata | KeyScope) =>
    select.keys(this.state, this.context.device.keys, scope)

  public userKeyring = (userId = this.userId) =>
    select.keyring(this.state, { type: USER, name: userId }, this.context.device.keys)

  /** Returns the keys for the given role. */
  public roleKeys = (roleName: string, generation?: number) =>
    this.keys({ type: KeyType.ROLE, name: roleName, generation })

  /** Returns the current team keys or a specific generation of team keys */
  public teamKeys = (generation?: number) => this.keys({ ...TEAM_SCOPE, generation })

  public teamKeyring = () => select.teamKeyring(this.state, this.context.device.keys)

  /** Returns the admin keyset. */
  public adminKeys = (generation?: number) => this.roleKeys(ADMIN, generation)

  /**
   * Replaces a member's secret keyset with the one provided. Whose keys these are is decided by
   * the name on the keyset, not by who's calling: normally you're rotating your own, but an admin
   * can re-key another member, which is what `canOnlyChangeYourOwnKeys` allows and what you'd do
   * for a member whose keys were compromised. The member picks the new keys up from the lockboxes
   * this rotates for their devices.
   *
   * Two consequences of re-keying someone else are worth being clear about: the admin who does it
   * necessarily generates the member's new secret keys and therefore knows them, and the member's
   * old keys are gone as far as the team is concerned. It isn't a substitute for removing someone.
   *
   * Only the caller's own keys are written back to `context.user` — an admin re-keying another
   * member has no business holding a keyset named for someone else. (That used to happen, and it
   * left the admin signing links with the other member's keys, which
   * `linkAuthorshipIsAuthentic` then rejected: her own team object was unusable from then on.)
   *
   * A server's keys can't be rotated at all: a server can only admit members and devices
   * (`serversCanOnlyAdmit`), and there's no action for anyone to do it on its behalf either. To
   * re-key a server, remove it and add it back with new keys.
   */
  public changeKeys = (newKeys: KeysetWithSecrets) => {
    const { user } = this.context
    const { type, name: targetId } = newKeys

    assert(type !== DEVICE, "Can't change device keys")
    assert(
      type === USER,
      `A server's keys can't be rotated (remove the server and add it back instead).`
    )

    const targetIsMe = targetId === this.userId

    // The generation these keys supersede is the target member's, which is only ours if we're
    // rotating our own. (`rotateKeys` settles a generation for any scope that has lockboxes, from
    // the highest among them; this is what stands if the member has no lockboxes of their own.)
    const oldKeys: Keyset | KeysetWithSecrets = targetIsMe ? user.keys : this.members(targetId).keys
    newKeys.generation = oldKeys.generation + 1

    // Treat the old keys as compromised, and generate new lockboxes for any keys they could see
    const lockboxes = this.rotateKeys(newKeys)

    // Post the new public keys to the graph
    const keys = redactKeys(newKeys)
    this.dispatch({ type: 'CHANGE_MEMBER_KEYS', payload: { keys, lockboxes } })

    // Update our keys in context — but only if they're ours
    if (targetIsMe) user.keys = newKeys
  }

  /**
   * Picks up new keys for ourselves after a rotation.
   *
   * The keyset we take is the one the graph makes current for our own scope, not the highest
   * generation in our keyring. Both halves of the old version were numbers off a lockbox:
   * `getLatestGeneration` takes the largest `generation` field among the keysets, and the
   * comparison that guarded it read the same field. So a member could hand us a keyset of theirs,
   * addressed to our device and called generation 9 — `USER` keys to a `DEVICE`, which is the one
   * pairing the door has to allow — and we would adopt it as our own. Measured: `user.keys` became
   * the forger's, which is what we sign links with.
   *
   * See `select.keys`, which is where "current" is decided from `state.keyHistory`.
   */
  private updateUserKeys() {
    const { user } = this.context
    const scope = { type: USER, name: this.userId }
    const held = select.keyMap(this.state, this.context.device.keys)[scope.type]?.[scope.name]
    if (held === undefined || held.size === 0) return

    const currentKeys = select.keys(this.state, this.context.device.keys, scope)
    if (currentKeys.encryption.publicKey === user.keys.encryption.publicKey) return

    // ...but only if they're keys the team registered as ours. A lockbox naming our scope is one
    // anybody can post, and adopting one of those would leave us signing links under a key no peer
    // recognises — unable to act at all, and holding a keyset its author can read.
    if (!isRegisteredEncryptionKey(this.state, this.userId, currentKeys.encryption.publicKey))
      return

    user.keys = currentKeys
  }

  private checkForPendingKeyRotations() {
    // Only admins can rotate keys
    if (!this.memberIsAdmin(this.userId)) {
      return
    }

    for (const userId of this.state.pendingKeyRotations) {
      // We don't know if the user was added to any other roles, so we're just preemptively rotating
      // all lockboxes *we* can see (since we're an admin, we have access to all keys)
      const lockboxes = this.rotateKeys({
        type: USER,
        name: this.userId,
      })
      this.dispatch({ type: 'ROTATE_KEYS', payload: { userId, lockboxes } })
    }
  }

  private readonly createMemberLockboxes = (member: Member) => {
    const roleKeys = member.roles.map(this.roleKeys)
    const createLockboxRoleKeysForMember = (keys: KeysetWithSecrets) => {
      return lockbox.create(keys, member.keys)
    }
    return [...roleKeys, this.teamKeys()].map(createLockboxRoleKeysForMember)
  }

  /**
   * Given a compromised scope (e.g. a member or a role), find all scopes that are visible from that
   * scope, and generates new keys and lockboxes for each of those. Returns all of the new lockboxes
   * in a single array to be posted to the graph.
   *
   * You can pass it a scope, or a keyset (which includes the scope information). If you pass a
   * keyset, it will replace the existing keys with these.
   *
   * @param compromised If `compromised` is a keyset, that will become the new keyset for the
   * compromised scope. If it is just a scope, new keys will be randomly generated for that scope.
   */
  private readonly rotateKeys = (compromised: KeyScope | KeysetWithSecrets) => {
    const newKeyset = isKeyset(compromised)
      ? compromised // We're given a keyset - use it as the new keys
      : createKeyset(compromised) // We're just given a scope - generate new keys for it

    // identify all the keys that are indirectly compromised
    const visibleScopes = select.visibleScopes(this.state, compromised)
    const otherNewKeysets = visibleScopes.map(scope => createKeyset(scope))

    // Generate new keys for each one
    const newKeysets = [newKeyset, ...otherNewKeysets]

    /**
     * Settle each scope's new generation before making any lockboxes.
     *
     * Every recipient of a scope's keys has to end up holding them under the same number, because
     * that number is what `Team.encrypt` writes onto a message and what the reader looks the keys up
     * by. Deriving it per lockbox — from the one it replaces, as `lockbox.rotate` used to — meant a
     * single lockbox claiming to be ahead of the others split the scope: its recipient's replacement
     * came out several generations clear of everyone else's, holding the same secret under a number
     * nobody else could find it by.
     *
     * A scope with no lockboxes at all keeps whatever generation it arrived with. That's the case
     * `changeKeys` relies on to supersede a member's own generation when they haven't added a device
     * yet.
     *
     * The generation comes from the graph, not from any manifest and not from what we hold.
     *
     * A manifest's generation belongs to whoever wrote the lockbox, and `current + 1` over the
     * maximum of them put that number in the arithmetic every rotation does. Counting from the
     * generation we can OPEN instead — which this did — doesn't escape that, because a lockbox
     * addressed to us is also a write by someone else into our key history: it made the member a
     * forgery is aimed at into the numbering authority for the whole team.
     *
     * There is no ceiling that fixes this. Whatever value a payload check accepts as the largest, a
     * member can name it, and the rotation that has to supersede it then needs one more than the
     * largest acceptable value — so its own link is refused, by its own author's check. Measured
     * at generation 2**53-2, by both routes: `remove` threw `no usable generation on its contents
     * manifest ('9007199254740991')` and went on throwing, for every member, permanently.
     *
     * `state.keyHistory` is not something an author can assert. The reducer appends a keyset to a
     * scope's list the first time the graph carries it, so a member can move a scope's count by one
     * per lockbox they actually post, and no further — a number, however large, buys nothing. On a
     * graph with nothing forged on it this is exactly the old arithmetic: each generation of a scope
     * contributes one keyset, so the list's length is the next generation.
     *
     * It also answers for a scope we can't see into. `remove(userId)` rotates `{type: USER, name:
     * userId}`, which the remover can never open, so every removal used to take the fallback to the
     * manifests — and one unopenable lockbox claiming a large generation for the member being
     * removed was enough to stop them ever being removed.
     *
     * A scope the graph has never carried keeps whatever generation it arrived with. That's the case
     * `changeKeys` relies on to supersede a member's own generation when they haven't added a device
     * yet.
     */
    const rotations = newKeysets.map(newKeyset => {
      const oldLockboxes = select.lockboxesInScope(this.state, newKeyset)
      if (oldLockboxes.length > 0) {
        newKeyset.generation = (this.state.keyHistory[keyHistoryKey(newKeyset)] ?? []).length
      }

      return { newKeyset, oldLockboxes }
    })

    // Create new lockboxes for each of these
    const newLockboxes = rotations.flatMap(({ newKeyset, oldLockboxes }) =>
      oldLockboxes.map(oldLockbox => {
        // Check whether we have new keys for the recipient of this lockbox
        const updatedKeyset = newKeysets.find(k => scopesMatch(k, oldLockbox.recipient))
        return lockbox.rotate({
          oldLockbox,
          newContents: newKeyset,
          // If we did, address the new lockbox to those keys
          updatedRecipientKeys: updatedKeyset ? redactKeys(updatedKeyset) : undefined,
        })
      })
    )

    return newLockboxes
  }
}

type LookupOptions = {
  includeRemoved: boolean
}

type TeamEvents = {
  updated: (payload: { head: Hash[] }) => void
}
