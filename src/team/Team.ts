import { signatures, symmetric } from '@herbcaudill/crypto'
import { EventEmitter } from 'events'
import * as chain from '/chain'
import { SignatureChain, SignedLink } from '/chain'
import { LocalUserContext } from '/context'
import { DeviceInfo, getDeviceId } from '/device'
import * as invitations from '/invitation'
import { ProofOfInvitation } from '/invitation'
import * as keyset from '/keyset'
import { ADMIN_SCOPE, KeyMetadata, KeyScope, KeysetWithSecrets, KeyType, TEAM_SCOPE } from '/keyset'
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
  TeamLinkBody,
  TeamOptions,
  TeamState,
} from '/team/types'
import * as user from '/user'
import { User } from '/user'
import { Optional, Payload } from '/util'

const { DEVICE, ROLE, MEMBER } = KeyType

export class Team extends EventEmitter {
  constructor(options: TeamOptions) {
    super()
    this.context = options.context

    if (isNewTeam(options)) {
      // Create a new team with the current user as founding member
      const localUser = this.context.user

      // Team & role secrets are never stored in plaintext, only encrypted into individual lockboxes.
      // Here we create new lockboxes with the team & admin keys for the founding member
      const teamLockbox = lockbox.create(keyset.create(TEAM_SCOPE), localUser.keys)
      const adminLockbox = lockbox.create(keyset.create(ADMIN_SCOPE), localUser.keys)

      const payload = {
        teamName: options.teamName,
        rootMember: user.redact(localUser),
        lockboxes: [teamLockbox, adminLockbox],
      }
      // Post root link to signature chain
      this.chain = chain.create<TeamLinkBody>(payload, this.context)
    } else {
      // Load a team from a serialized chain
      this.chain = chain.deserialize(options.source)
    }
    this.updateState()
  }

  // # PUBLIC API

  public get teamName() {
    return this.state.teamName
  }

  public save = () => chain.serialize(this.chain)

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

  // ## WRITE METHODS

  // Most of the logic for modifying team state is in reducers. To mutate team state, we dispatch
  // changes to the signature chain, and then run the chain through the reducer to recalculate team
  // state.
  //
  // Any crypto operations involving the current user's secrets (for example, opening or creating
  // lockboxes, or signing links) are done here. Only the public-facing outputs (for example, the
  // resulting lockboxes, the signed links) are posted on the chain.

  /** Add a member to the team */
  public add = (member: User | Member, roles: string[] = []) => {
    // don't leak user secrets if we have them
    const redactedUser = user.redact(member)

    // make lockboxes for the new member
    const teamLockbox = lockbox.create(this.teamKeys(), member.keys)
    const roleLockboxes = roles.map(roleName =>
      lockbox.create(this.roleKeys(roleName), member.keys)
    )
    const lockboxes = [teamLockbox, ...roleLockboxes]

    // post the member to the signature chain
    this.dispatch({
      type: 'ADD_MEMBER',
      payload: { member: redactedUser, roles, lockboxes },
    })

    // TODO - this should just be this.addDevice
    // this.inviteDevice(member.device)
  }

  /** Remove a member from the team */

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

  /** Add a role to the team */
  public addRole = (role: Role) => {
    // we're creating this role so we need to generate new keys
    const roleKeys = keyset.create({ type: ROLE, name: role.roleName })

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
    // create new keys & lockboxes for any keys this person had access to via this role
    const lockboxes = this.rotateKeys({ type: ROLE, name: roleName })

    // post the removal to the signature chain
    this.dispatch({
      type: 'REMOVE_MEMBER_ROLE',
      payload: { userName, roleName, lockboxes },
    })
  }

  // Invitations

  /** Invite a new member to the team
   *
   * If you don't provide a `secretKey`, a 16-character base30 string will be randomly generated. If
   * you do provide a key, it will be stripped of non-alphanumeric characters and lower-cased, so
   * you'll need to take that into account when determining the appropriate key strength.
   * Normalizing the key this way allows us to show it to the user split into blocks
   * (e.g. `4kgd 5mwq 5z4f mfwq`) and/or make it URL-safe (e.g. `4kgd+5mwq+5z4f+mfwq`).
   */
  public invite = (
    userName: string,
    roles: string[] = [],
    secretKey = invitations.newInvitationKey()
  ) => {
    // generate invitation
    const teamKeys = this.teamKeys()
    const invitation = invitations.inviteMember({
      teamKeys,
      payload: { userName, roles },
      secretKey,
    })

    // post invitation to signature chain
    this.dispatch({
      type: 'POST_INVITATION',
      payload: { invitation },
    })

    return {
      secretKey,
      id: invitation.id,
    }
  }

  /** Revoke an invitation. This can be used for member invitations as well as device invitations. */
  public revokeInvitation = (id: string) => {
    this.dispatch({
      type: 'REVOKE_INVITATION',
      payload: { id },
    })
  }

  /** Admit a new member to the team based on proof of invitation */
  public admit = (proof: ProofOfInvitation) => {
    const typeError = new Error('Team.admit() is only for accepting invitations for members.')
    // ignore coverage
    if (proof.type !== MEMBER) throw typeError

    const { id, payload: member } = proof

    const teamKeys = this.teamKeys()

    // look up the invitation
    const encryptedInvitation = this.state.invitations[id]
    // ignore coverage
    if (encryptedInvitation === undefined) throw new Error(`No invitation with id '${id}' found.`)

    // open the invitation
    const invitation = invitations.open(encryptedInvitation, teamKeys)
    if (invitation.type !== MEMBER) throw typeError

    // validate proof against original invitation
    const validation = invitations.validate(proof, encryptedInvitation, teamKeys)
    if (validation.isValid === false) throw validation.error

    const { roles = [] } = invitation.payload

    // all good, let them in
    // post admission to the signature chain
    this.dispatch({
      type: 'ADMIT_INVITED_MEMBER',
      payload: { id, member, roles },
    })
  }

  // Devices

  public inviteDevice = (deviceInfo: DeviceInfo, secretKey = invitations.newInvitationKey()) => {
    // generate invitation
    const teamKeys = this.teamKeys()

    const { userName } = deviceInfo
    const deviceId = getDeviceId(deviceInfo)
    const invitation = invitations.inviteDevice({
      teamKeys,
      payload: { deviceId, userName },
      secretKey,
    })

    // post invitation to signature chain
    this.dispatch({
      type: 'POST_INVITATION',
      payload: { invitation },
    })

    // if the caller didn't provide the secret key, they'll need that
    // they might also need the invitation id in case they want to revoke it
    return {
      secretKey,
      id: invitation.id,
    }
  }

  /** Admit a new device based on proof of invitation */
  public admitDevice = (proof: ProofOfInvitation) => {
    const typeError = new Error('Team.admitDevice() is only for accepting invitations for devices.')
    // ignore coverage
    if (proof.type !== DEVICE) throw typeError

    const { id, payload: device } = proof

    const teamKeys = this.teamKeys()

    // look up the invitation
    const invitation = this.state.invitations[id]
    if (invitation === undefined) throw new Error(`An invitation with id '${id}' was not found.`)

    // validate proof against original invitation
    const validation = invitations.validate(proof, invitation, teamKeys)
    if (validation.isValid === false) throw validation.error

    // open the invitation
    const invitationBody = invitations.open(invitation, teamKeys)
    // ignore coverage
    if (invitationBody.type !== DEVICE) throw typeError

    // all good, let them in
    // post admission to the signature chain
    this.dispatch({
      type: 'ADMIT_INVITED_DEVICE',
      payload: { id, device },
    })
  }

  public removeDevice = (deviceInfo: DeviceInfo) => {
    const { userName } = deviceInfo
    const deviceId = getDeviceId(deviceInfo)

    // create new keys & lockboxes for any keys this device had access to
    const lockboxes = this.rotateKeys({ type: DEVICE, name: deviceId })

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

  // ## CRYPTO

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
      name: this.context.user.userName,
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

  // # PRIVATE PROPERTIES

  private context: LocalUserContext
  private chain: SignatureChain<TeamLinkBody>
  private state: TeamState = initialState // derived from chain, only updated by running chain through reducer

  // # PRIVATE METHODS

  // Keys

  // These methods all return keysets with secrets, and will throw an error if the local user
  // does not have access to the requested keys. To get other members' keys, look up the member -
  // the `keys` property contains their public keys.

  /** Returns the keyset (if available to the current user) for the given type and name */
  public keys = (scope: Optional<KeyMetadata, 'generation'>): KeysetWithSecrets =>
    select.keys(this.state, this.context.user, scope)

  /** Returns the team keyset */
  public teamKeys = (): KeysetWithSecrets => this.keys(TEAM_SCOPE)

  /** Returns the keys for the given role */
  public roleKeys = (roleName: string): KeysetWithSecrets =>
    this.keys({ type: ROLE, name: roleName })

  /** Returns the admin keyset */
  public adminKeys = (): KeysetWithSecrets => this.roleKeys(ADMIN)

  /** Given a compromised scope (e.g. a member or a role), find all scopes that are visible from that
   * scope, and generates new keys and lockboxes for each of those. Returns all of the new lockboxes in
   * a single array to be posted to the signature chain. */

  private rotateKeys(compromisedScope: KeyScope) {
    // make a list containing this scope plus all scopes that it sees
    const compromisedScopes = select.scopesToRotate(this.state, compromisedScope)

    // generate new keys and lockboxes for each one
    const newLockboxes = compromisedScopes.flatMap(scope => {
      const keys = keyset.create(scope)
      const oldLockboxes = select.lockboxesInScope(this.state, scope)
      const newLockboxes = oldLockboxes.map(oldLockbox => lockbox.rotate(oldLockbox, keys))
      return newLockboxes
    })

    return newLockboxes
  }

  // Team state

  /** Add a link to the chain, then recompute team state from the new chain */
  public dispatch(link: TeamAction) {
    this.chain = chain.append<TeamLinkBody>(this.chain, link, this.context)
    const head = chain.getHead(this.chain) as SignedLink<TeamLinkBody>
    // we don't need to pass the whole chain through the reducer, just the current state + the new head
    this.state = reducer(this.state, head)
  }

  /** Run the reducer on the entire chain to reconstruct the current team state. */
  private updateState = () => {
    // Validate the chain's integrity. (This does not enforce team rules - that is done in the
    // reducer as it progresses through each link.)
    const validation = chain.validate(this.chain)
    if (!validation.isValid) throw validation.error

    // Run the chain through the reducer to calculate the current team state
    // TODO: create reconciler to implement strong-remove
    // const sequence = chains.getSequence(this.chain, reconciler)
    const sequence = chain.getSequence(this.chain)
    this.state = sequence.reduce(reducer, initialState)
  }
}
