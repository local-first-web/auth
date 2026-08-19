import { debug, truncateHashes } from '@localfirst/shared'
import { ROOT, type Base58 } from '@localfirst/crdx'
import { hashKeys, invitationCanBeUsed, validate as validateProof } from '../invitation/index.js'
import { type Lockbox } from '../lockbox/index.js'
import { ADMIN } from '../role/index.js'
import { KeyType, VALID, ValidationError, actionFingerprint } from '../util/index.js'
import { isUsableIdentifier, payloadProblem } from './checkPayload.js'
import { isAdminOnlyAction } from './isAdminOnlyAction.js'
import { isRegisteredEncryptionKey, registeredEncryptionKeys } from './registeredEncryptionKeys.js'
import * as select from './selectors/index.js'
import {
  type Member,
  type TeamAction,
  type TeamLink,
  type TeamState,
  type TeamStateValidator,
  type TeamStateValidatorSet,
  type ValidationArgs,
} from './types.js'

const log = debug.extend('auth:validate')

export const validate: TeamStateValidator = (...args: ValidationArgs) => {
  for (const key in validators) {
    const validator = validators[key]
    const validation = validator(...args)
    if (!validation.isValid) {
      return validation
    }
  }

  return VALID
}

const validators: TeamStateValidatorSet = {
  /**
   * The link has to have been encrypted with a key belonging to the member it's attributed to.
   *
   * Every other validator here decides what an author is allowed to do, based on `body.userId` —
   * so without this one, none of them mean anything: anyone holding the team keys could author a
   * link naming someone else and inherit their authority. `senderPublicKey` is the author's own
   * encryption key, and they can't misreport it, because the link only opens with the matching
   * secret.
   */
  linkAuthorshipIsAuthentic(...args) {
    const [previousState, link] = args
    const { type, userId } = link.body

    // The root link is what establishes the founding member's keys, so there's nothing yet to
    // check it against. Standing aside costs nothing, because a link has to clear every rule here:
    // `rootLinkCanOnlyBeTheFirstLink` refuses any ROOT link that isn't the graph's first.
    if (type === ROOT) return VALID

    if (!isRegisteredEncryptionKey(previousState, userId, link.senderPublicKey)) {
      const msg = `Can't verify authorship: this link is attributed to '${userId}', but wasn't encrypted with any key belonging to them.`
      return fail(msg, ...args)
    }

    return VALID
  },

  /**
   * A server can only admit invited members and devices.
   *
   * We give a server the team keys so it can decrypt and relay the graph, but it isn't a member and
   * has no standing to change the team. Admitting invitees is the one exception, so that a device
   * can join by way of a server in a star-shaped network. Without this rule, a server could author
   * any action that isn't admin-only — including posting a device invitation naming a member as
   * the owner, and then admitting a device of its own onto that member's account.
   */
  serversCanOnlyAdmit(...args) {
    const [previousState, link] = args
    const { type, userId } = link.body

    // The root link can't have been authored by a server: a server can't create a team
    if (type === ROOT) return VALID

    // Removed servers are included: losing your place on the team doesn't earn you more authority
    const authorIsServer = [...previousState.servers, ...previousState.removedServers].some(
      ({ host }) => host === userId
    )
    if (!authorIsServer) return VALID

    if (type !== 'ADMIT_MEMBER' && type !== 'ADMIT_DEVICE') {
      const msg = `A server can only admit members and devices; '${userId}' can't author a '${type}' link.`
      return fail(msg, ...args)
    }

    return VALID
  },

  /**
   * Someone who's been removed from the team can't author anything at all.
   *
   * `serversCanOnlyAdmit` confines a removed server to admissions, but admitting is exactly what
   * someone who's been let go is still in a position to do — an ex-member as much as an ex-server.
   * Their encryption key stays registered (so that the links they authored while on the team remain
   * valid), admitting isn't admin-only, and an invitation they learned about before being removed
   * is still open. So without this, either of them could keep putting members and devices of their
   * choosing onto the team.
   *
   * This only speaks to links that come after the removal in the sequence. Anything authored
   * concurrently with the author's own removal is the resolver's business —
   * `cantDoAnythingWhenRemoved` discards those.
   */
  removedMembersAndServersCantDoAnything(...args) {
    const [previousState, link] = args
    const { type, userId } = link.body

    // The root link is what puts the founding member on the team, so there's nobody removed yet.
    // `rootLinkCanOnlyBeTheFirstLink` is what makes that true of any ROOT link that gets applied:
    // it refuses one whose previous state isn't empty.
    if (type === ROOT) return VALID

    // Being re-added clears the tombstone, so anyone who's back on the team is unencumbered
    const isCurrentMember = previousState.members.some(member => member.userId === userId)
    const isCurrentServer = previousState.servers.some(({ host }) => host === userId)
    if (isCurrentMember || isCurrentServer) return VALID

    if (previousState.removedServers.some(({ host }) => host === userId)) {
      const msg = `The server '${userId}' was removed from the team, so it can't author a '${type}' link.`
      return fail(msg, ...args)
    }

    if (previousState.removedMembers.some(member => member.userId === userId)) {
      const msg = `'${userId}' was removed from the team, so they can't author a '${type}' link.`
      return fail(msg, ...args)
    }

    return VALID
  },

  /**
   * A link's payload has to carry what everything downstream is about to reach into.
   *
   * `payloadProblem` is the whole of that rule — every field the validators, the reducer and the
   * transforms dereference, for every action type — and `Team.dispatch` applies the same function
   * before a link is ever appended. Here it's applied to links as they're replayed, which is what
   * makes a peer's refusal independent of who sent it.
   *
   * This runs ahead of every rule that takes a payload apart, so those rules don't have to ask.
   */
  payloadsMustBeWellFormed(...args) {
    const [_previousState, link] = args
    const problem = payloadProblem(link.body as TeamAction)
    if (problem !== undefined) return fail(problem, ...args)
    return VALID
  },

  /**
   * A ROOT link is the link that creates the team, and nothing else is.
   *
   * Four rules step aside for `type === ROOT` — `linkAuthorshipIsAuthentic`,
   * `serversCanOnlyAdmit`, `removedMembersAndServersCantDoAnything` and `mustBeAdmin` — because at
   * the founding of a team there is nothing to check an author against: no registered keys, no
   * admins, no servers, nobody removed. That reasoning is sound only
   * for the graph's first link — and a link's type is just a word in its body. `Team.dispatch`
   * appends whatever action it's handed, so an ordinary member could post a ROOT link of their own
   * onto a team that already exists. All four would wave it through, and the reducer's
   * ROOT case would then run `setTeamName`, `addMember` and `addMemberRoles(rootMember.userId,
   * [ADMIN])` against the team as it stands: the author renames the team and makes themselves an
   * admin. `roleGrantMustIncludeKeys` doesn't stand in the way, because the admin keys a ROOT link
   * hands the founding member are the ones that link establishes — so a keyset the author minted
   * for themselves satisfies it.
   *
   * This is what pins the type to the one position where it means what those four assume. A link
   * has to clear every rule here to be applied, so their standing aside costs nothing: whatever
   * they decline to say about a ROOT link, this refuses it unless two independent things hold.
   *
   * - The link names no predecessors. crdx's `validateRoot` says the same thing about the graph as
   *   a whole — the predecessor-less link is the graph's root, and it's the ROOT link — so on a
   *   graph that has been through `makeMachine` this is exactly 'this is the root'. Checking it
   *   per link is what catches a dispatch, where no graph-wide validation runs.
   * - There is no team behind it yet. This is stated as what it is rather than by proxy:
   *   `teamAlreadyExists` names every part of the state those four rules read — `members`,
   *   `servers`, `removedMembers` and `removedServers`, plus `lockboxes`, which
   *   `isRegisteredEncryptionKey` falls back to when looking for a superseded generation of
   *   someone's keys. A state with all five empty is precisely the state they assume, whatever
   *   else may be true of it.
   *
   *   Only the first of those is load-bearing today, and the enumeration is deliberate rather than
   *   necessary: `head` alone decides every reachable state, since `setHead` records one for every
   *   link the reducer applies. Deleting the rest fails no test. They're here so the rule states
   *   its own premise instead of resting on `head` being a faithful proxy for it —
   *   `invalidLinkReducer` is a live path that returns without calling `setHead`, and if the
   *   resolver ever discarded a graph's first link, an empty `head` would stop meaning 'nothing
   *   applied' while the five would go on meaning exactly what they say.
   *
   * This leg holds whatever shape the graph is in and whatever the link claims about its own
   * position, and the one above holds whatever the reduction has done so far; neither leans on the
   * other, and either alone refuses the dispatch attack.
   *
   * Shape is settled before position is judged, so this sits after `payloadsMustBeWellFormed`.
   */
  rootLinkCanOnlyBeTheFirstLink(...args) {
    const [previousState, link] = args
    const { type } = link.body
    const hasNoPredecessors = link.body.prev.length === 0

    if (type === ROOT) {
      if (!hasNoPredecessors) {
        const msg = `A ROOT link founds the team, so it can't come after anything; this one names predecessors.`
        return fail(msg, ...args)
      }

      const teamAlreadyExists =
        previousState.head.length > 0 ||
        previousState.members.length > 0 ||
        previousState.servers.length > 0 ||
        previousState.removedMembers.length > 0 ||
        previousState.removedServers.length > 0 ||
        previousState.lockboxes.length > 0
      if (teamAlreadyExists) {
        const msg = `A ROOT link founds the team, so it can't be applied to a team that already exists.`
        return fail(msg, ...args)
      }

      return VALID
    }

    if (hasNoPredecessors) {
      const msg = `Only a ROOT link can be the first link on the graph; this one is a '${type}'.`
      return fail(msg, ...args)
    }

    return VALID
  },

  rootDeviceBelongsToRootUser(...args) {
    const [_previousState, link] = args
    const { type, payload } = link.body
    if (type !== 'ROOT') return VALID

    const { rootDevice, rootMember } = payload
    if (rootDevice.userId !== rootMember.userId) {
      const msg = 'The founding device must belong to the founding member (userIds must match).'
      return fail(msg, ...args)
    }
    return VALID
  },

  /** The user who made these changes was a member with appropriate rights at the time */
  mustBeAdmin(...args) {
    const [previousState, link] = args
    const action = link.body
    const { type, userId } = action

    // At the root link the team doesn't yet have members, so there's no admin to be.
    // `rootLinkCanOnlyBeTheFirstLink` is what makes that true of any ROOT link that gets applied:
    // it refuses one whose previous state isn't empty.
    if (type === ROOT) return VALID

    // Certain actions are allowed to be performed by non-members
    if (isAdminOnlyAction(action)) {
      const isntAdmin = !select.memberIsAdmin(previousState, userId)
      if (isntAdmin) {
        return fail(`Member '${userId}' is not an admin`, ...args)
      }
    }
    return VALID
  },

  /**
   * A removal has to name a device the team has, and unless I'm an admin it has to be one of mine.
   *
   * The existence check isn't only for this rule's benefit. `select.device` asserts rather than
   * answering when an id names nothing, and both this rule and the `removeDevice` transform look
   * the device up — so an id that names nothing came out of a replay as a bare Error rather than a
   * refusal, on every peer, for good. Refusing the link keeps the transform from ever seeing it.
   */
  canOnlyRemoveYourOwnDevices(...args) {
    const [previousState, link] = args
    if (link.body.type !== 'REMOVE_DEVICE') return VALID

    const target = link.body.payload.deviceId
    if (!select.hasDevice(previousState, target)) {
      const msg = `This link removes a device ('${String(target)}') that isn't on the team.`
      return fail(msg, ...args)
    }

    // Only admins can remove another user's devices
    const author = link.body.userId
    if (select.memberIsAdmin(previousState, author)) return VALID

    const deviceOwner = select.device(previousState, target).userId
    if (author !== deviceOwner) {
      return fail("Can't remove another user's device.", ...args)
    }

    return VALID
  },

  /** Unless I'm an admin, I can't add devices for anyone but myself */
  canOnlyAddYourOwnDevices(...args) {
    const [previousState, link] = args
    const author = link.body.userId

    // Only admins can add a device for another user
    const authorIsAdmin = select.memberIsAdmin(previousState, author)
    if (authorIsAdmin) return VALID

    if (link.body.type === 'ADD_DEVICE') {
      const deviceOwner = link.body.payload.device.userId
      if (author !== deviceOwner) {
        return fail("Can't add a device for another user.", ...args)
      }
    }
    return VALID
  },

  /** Unless I'm an admin, I can't change anyone's keys but my own */
  canOnlyChangeYourOwnKeys(...args) {
    const [previousState, link] = args
    const author = link.body.userId

    // Only admins can change another user's keys
    const authorIsAdmin = select.memberIsAdmin(previousState, author)
    if (!authorIsAdmin && link.body.type === 'CHANGE_MEMBER_KEYS') {
      const target = link.body.payload.keys.name
      if (author !== target) {
        return fail("Can't change another user's keys.", ...args)
      }
    }
    return VALID
  },

  /**
   * Granting someone a role has to hand them that role's keys.
   *
   * The reducer applies whatever lockboxes it's given and adds the role either way, so a role grant
   * with an empty `lockboxes` array used to make `memberHasRole` return true for someone holding
   * none of the role's keys. Applications gate on that predicate, so authorization would say yes
   * while key possession says no.
   *
   * All three paths that assign a role are covered: ADD_MEMBER_ROLE, the `roles` in an ADD_MEMBER
   * payload, and the ROOT link, which makes the founding member an admin. ADD_MEMBER and ROOT
   * establish the member's keys themselves, so the lockbox has to be addressed to the very keyset
   * the payload names; for ADD_MEMBER_ROLE the member is already on the team, and any generation of
   * their keys will do, since their keys may have been rotated concurrently with the grant and a
   * lockbox addressed to the superseded generation still reaches them.
   */
  roleGrantMustIncludeKeys(...args) {
    const [previousState, link] = args
    const failedGrant = (userId: string, roleName: string) =>
      fail(
        `Adding '${userId}' to the '${roleName}' role requires a lockbox holding that role's keys for them.`,
        ...args
      )

    if (link.body.type === 'ROOT') {
      const { rootMember, lockboxes = [] } = link.body.payload
      const isTheirKey = keyMatches(rootMember.keys.encryption)
      if (!rolesWithKeys(lockboxes, rootMember.userId, isTheirKey).has(ADMIN)) {
        return failedGrant(rootMember.userId, ADMIN)
      }

      return VALID
    }

    if (link.body.type === 'ADD_MEMBER') {
      const { member, roles = [], lockboxes = [] } = link.body.payload
      const isTheirKey = keyMatches(member.keys.encryption)
      const granted = rolesWithKeys(lockboxes, member.userId, isTheirKey)
      for (const roleName of roles) {
        if (!granted.has(roleName)) {
          return failedGrant(member.userId, roleName)
        }
      }

      return VALID
    }

    if (link.body.type === 'ADD_MEMBER_ROLE') {
      const { userId, roleName, lockboxes = [] } = link.body.payload
      const isTheirKey = keyIsRegisteredTo(previousState, userId)
      if (!rolesWithKeys(lockboxes, userId, isTheirKey).has(roleName)) {
        return failedGrant(userId, roleName)
      }
    }

    return VALID
  },

  /**
   * Check for ADMIT with invitations that are revoked, expired, used more than maxUses, or already
   * spent on the invitee being admitted.
   */
  cantAdmitWithInvalidInvitation(...args) {
    const [previousState, link] = args
    if (link.body.type === 'ADMIT_MEMBER' || link.body.type === 'ADMIT_DEVICE') {
      const { id, proof } = link.body.payload

      // The invitation has to be one the team has actually seen. `select.getInvitation` asserts
      // when it isn't, which would leave a validator throwing a bare Error mid-replay instead of
      // refusing the link — and `admissionMustBeProven`, which looks the same invitation up to
      // check the proof against it, relies on this having happened first.
      if (!select.hasInvitation(previousState, id)) {
        const msg = `This admission names an invitation ('${String(id)}') that the team doesn't have.`
        return fail(msg, ...args)
      }

      const invitation = select.getInvitation(previousState, id)

      // A missing proof is `admissionMustBeProven`'s to complain about
      return invitationCanBeUsed(invitation, link.body.timestamp, proof?.invitee)
    }
    return VALID
  },

  /**
   * An admission has to carry the invitee's proof of invitation, and that proof has to name the
   * identity being admitted.
   *
   * The admitter checks the proof before posting, but their say-so is all any other peer used to
   * have: an ADMIT link with a fabricated invitation id was accepted by everyone downstream. Since
   * the proof is bound to the identity it admits, carrying it on the graph is safe, and it makes
   * admission verifiable by everyone who replays the chain.
   */
  admissionMustBeProven(...args) {
    const [previousState, link] = args
    if (link.body.type !== 'ADMIT_MEMBER' && link.body.type !== 'ADMIT_DEVICE') return VALID

    const { id, proof } = link.body.payload
    if (!proof) {
      return fail('This admission does not include a proof of invitation.', ...args)
    }

    // The proof has to be signed with the ephemeral key recorded in the invitation
    const invitation = select.getInvitation(previousState, id)
    const proofValidation = validateProof(proof, invitation)
    if (!proofValidation.isValid) {
      return fail(`Invalid proof of invitation: ${proofValidation.error.message}`, ...args)
    }

    // The proof names exactly one identity, and this has to be it
    const invitee =
      link.body.type === 'ADMIT_MEMBER'
        ? link.body.payload.memberKeys.name
        : link.body.payload.device.deviceId

    // ...and that identity has to be an identity. A member's identifier is the `name` on the keyset
    // they chose for themselves, and nothing about a keyset requires it to have one — but every
    // check that goes by it reads as satisfied when it's missing on both sides. `proof.invitee !==
    // invitee` compares nothing to nothing; the record of whom an invitation has admitted can't
    // recognize whom it admitted; and a member ends up on the team with no userId to be removed by.
    if (!isUsableIdentifier(invitee)) {
      const identifier = link.body.type === 'ADMIT_MEMBER' ? 'userId' : 'deviceId'
      const msg = `An admission has to name the invitee it admits, and '${String(invitee)}' is not a usable ${identifier}.`
      return fail(msg, ...args)
    }

    if (proof.invitee !== invitee) {
      const msg = `This invitation was issued to '${proof.invitee}', so it can't be used to admit '${invitee}'.`
      return fail(msg, ...args)
    }

    // The proof also fingerprints the keyset the invitee chose for themselves, and this has to be
    // that keyset. Without this the admitter would pick the keys: the identifier admitted would be
    // the invitee's, but the secrets would be the admitter's, and the admitter could then author
    // links as the invitee (`linkAuthorshipIsAuthentic` would accept them, since the key is
    // registered to the invitee) and add devices of its own under them.
    const admittedKeys =
      link.body.type === 'ADMIT_MEMBER'
        ? link.body.payload.memberKeys
        : link.body.payload.device.keys
    if (proof.keyHash !== hashKeys(admittedKeys)) {
      const msg = `This proof of invitation commits to a different keyset than the one being admitted.`
      return fail(msg, ...args)
    }

    // An invitation only admits the kind of invitee it was issued for. The invitation says which
    // kind it is; `invitationsNameTheRightKindAndOwner` is what makes that claim reliable.
    // Inviting a device is open to every member while inviting a member is admin-only, so without
    // this an ordinary member could spend a device invitation of their own on a member admission
    // and hand full membership — and the team keyring — to an outsider.
    if (link.body.type === 'ADMIT_MEMBER') {
      if (invitation.kind !== 'MEMBER') {
        const msg = `This is a device invitation, so it can't be used to admit a member.`
        return fail(msg, ...args)
      }
    } else {
      if (invitation.kind !== 'DEVICE') {
        const msg = `This is a member invitation, so it can't be used to admit a device.`
        return fail(msg, ...args)
      }

      // A device invitation also names the member the device will belong to. `admitDevice` takes
      // the owner from the invitation, but that binds only the admitter's own copy: the payload is
      // what every other peer applies, and `addDevice` files the device under whoever it names.
      // Without this, a member could admit a device of their own onto someone else's account, and
      // `memberByDeviceId` would resolve that device to its victim.
      const owner = link.body.payload.device.userId
      if (owner !== invitation.userId) {
        const msg = `This invitation was issued for a device belonging to '${invitation.userId}', so it can't be used to add a device to '${owner}'.`
        return fail(msg, ...args)
      }
    }

    return VALID
  },

  /**
   * An invitation has to be the kind its link says it is, and a device invitation has to name the
   * member issuing it as the owner.
   *
   * `inviteMember` and `inviteDevice` populate both correctly, and the types make it impossible for
   * them not to — but a member can author the link directly, and nothing about the graph stops them
   * from putting whatever they like in the payload. Inviting a device is open to every member while
   * inviting a member is admin-only, so an unchecked `kind` would let an ordinary member post a
   * member invitation through `INVITE_DEVICE` and then hand full membership to an outsider. A
   * device invitation naming someone else would admit a device onto that member's account.
   */
  invitationsNameTheRightKindAndOwner(...args) {
    const [_previousState, link] = args

    if (link.body.type !== 'INVITE_MEMBER' && link.body.type !== 'INVITE_DEVICE') return VALID

    // The payload types describe what honest code produces; what actually arrived is either kind.
    // That there's an invitation here at all is `payloadsMustBeWellFormed`'s to insist on.
    const { invitation } = link.body.payload

    if (link.body.type === 'INVITE_MEMBER') {
      if (invitation.kind !== 'MEMBER') {
        const msg = `An INVITE_MEMBER link has to carry a member invitation, but this one carries a device invitation.`
        return fail(msg, ...args)
      }

      return VALID
    }

    if (invitation.kind !== 'DEVICE') {
      const msg = `An INVITE_DEVICE link has to carry a device invitation, but this one carries a member invitation.`
      return fail(msg, ...args)
    }

    const { userId: owner } = invitation
    if (owner !== link.body.userId) {
      const msg = `A device invitation has to be for the member issuing it, but this one is for '${owner}'.`
      return fail(msg, ...args)
    }

    return VALID
  },

  /**
   * An invitation can only be posted once.
   *
   * An invitation is public and sits on the graph, so anyone who has seen it can author another
   * INVITE link carrying the very same one. `postInvitation` files it under its id, and a second
   * link filing the same id used to replace what was there — putting `uses` back to 0, emptying
   * the record of whom the invitation had admitted, and clearing `revoked`. Inviting a device is
   * open to every member, so that handed each of them a way out of any limit or revocation on an
   * invitation of their own.
   *
   * Merging instead of replacing would keep the counters honest, but it would also accept the
   * second link and produce an invitation that is already spent — a seed the invitee is holding
   * that can never be redeemed, and no way to tell that from the graph. Refusing says so.
   *
   * The id is derived from the seed, and the seed can be chosen by the caller, so two honest
   * invitations CAN collide — `inviteMember`/`inviteDevice` catch that before dispatching anything,
   * because a link refused here is still appended to the graph and would leave it unreplayable.
   * This is the backstop for the links that don't come from there.
   */
  invitationsCanOnlyBePostedOnce(...args) {
    const [previousState, link] = args
    if (link.body.type !== 'INVITE_MEMBER' && link.body.type !== 'INVITE_DEVICE') return VALID

    // That there's an invitation here at all is `payloadsMustBeWellFormed`'s to insist on
    const { invitation } = link.body.payload
    if (select.hasInvitation(previousState, invitation.id)) {
      const msg = `The invitation '${invitation.id}' has already been posted, and re-posting it would reset it.`
      return fail(msg, ...args)
    }

    return VALID
  },

  /** Check if userId and userName are not used by any other member within the team */
  uniqueUserNameAndId(...args) {
    const [previousState, link] = args
    if (link.body.type === 'ADMIT_MEMBER') {
      const { userName, memberKeys } = link.body.payload
      const hasUserId = ({ userId }: Member) => userId === memberKeys.name
      const hasUserName = (member: Member) =>
        member.userName.toLowerCase() === userName.toLowerCase()

      if (previousState.members.some(hasUserId)) {
        return fail('userId is not unique within the team.', ...args)
      }

      if (previousState.members.some(hasUserName)) {
        return fail('Username is not unique within the team.', ...args)
      }
    }
    return VALID
  },
}

/**
 * The roles whose keys these lockboxes actually hand to `userId`.
 *
 * The work here is bounded on purpose. Ruling out an encryption key can cost a scan of every
 * lockbox the team has, and a payload can name any number of lockboxes — so we match on the names
 * first, and hand the survivors to `isTheirKey`, which does the expensive part at most once however
 * many there are. One pass covers every role the payload grants, so a link granting many roles
 * doesn't multiply the work either.
 */
const rolesWithKeys = (
  lockboxes: Lockbox[],
  userId: string,
  isTheirKey: (publicKey: Base58) => boolean
) => {
  const roleKeysForThisUser = lockboxes.filter(
    ({ contents, recipient }) =>
      contents.type === KeyType.ROLE && recipient.type === KeyType.USER && recipient.name === userId
  )

  return new Set(
    roleKeysForThisUser
      .filter(({ recipient }) => isTheirKey(recipient.publicKey))
      .map(({ contents }) => contents.name)
  )
}

/** For a member whose keys this very link establishes, the keyset it names is the only one there is. */
const keyMatches = (publicKey: Base58) => (candidate: Base58) => candidate === publicKey

/**
 * For a member who is already on the team, any generation of their keys will do: their keys may
 * have been rotated concurrently with the grant, and a lockbox addressed to the superseded
 * generation still reaches them.
 *
 * Their current keys answer the honest case without looking at any lockboxes at all; recovering the
 * superseded generations means walking them, so that happens only if it has to, and only once.
 */
const keyIsRegisteredTo = (state: TeamState, userId: string) => {
  const currentKey = (
    state.members.find(m => m.userId === userId) ??
    state.removedMembers.find(m => m.userId === userId)
  )?.keys.encryption

  let everyGeneration: Set<Base58> | undefined
  return (candidate: Base58) => {
    if (candidate === currentKey) return true
    everyGeneration ??= registeredEncryptionKeys(state).get(userId) ?? new Set()
    return everyGeneration.has(candidate)
  }
}

const fail = (message: string, previousState: TeamState, link: TeamLink) => {
  message = truncateHashes(`${actionFingerprint(link)} ${message}`)
  log(message)
  return {
    isValid: false,
    error: new ValidationError(message, { prevState: previousState, link }),
  }
}
