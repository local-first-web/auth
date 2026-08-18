import { debug, truncateHashes } from '@localfirst/shared'
import { ROOT } from '@localfirst/crdx'
import {
  hashKeys,
  invitationCanBeUsed,
  type Invitation,
  validate as validateProof,
} from 'invitation/index.js'
import { KeyType, VALID, ValidationError, actionFingerprint } from 'util/index.js'
import { isAdminOnlyAction } from './isAdminOnlyAction.js'
import { isRegisteredEncryptionKey } from './registeredEncryptionKeys.js'
import * as select from './selectors/index.js'
import {
  type Member,
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
    // check it against
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
   * A server that's been removed from the team can't author anything at all.
   *
   * `serversCanOnlyAdmit` confines a removed server to admissions, but admitting is exactly what an
   * ex-server is still in a position to do: its encryption key stays registered (so that the links
   * it authored while on the team remain valid), admitting isn't admin-only, and an invitation it
   * learned about before being removed is still open. So a server that's been let go could keep
   * putting members and devices of its choosing onto the team.
   *
   * This only speaks to links that come after the removal in the sequence. An admission the server
   * makes concurrently with its own removal is the resolver's business — `cantDoAnythingWhenRemoved`
   * discards those, the same way it does for a member who is concurrently removed.
   */
  removedServersCantDoAnything(...args) {
    const [previousState, link] = args
    const { type, userId } = link.body

    // A server can't have authored the root link: a server can't create a team
    if (type === ROOT) return VALID

    // Being re-added clears the tombstone, so a server that's back on the team is unencumbered
    const isCurrentServer = previousState.servers.some(({ host }) => host === userId)
    if (isCurrentServer) return VALID

    const wasRemoved = previousState.removedServers.some(({ host }) => host === userId)
    if (wasRemoved) {
      const msg = `The server '${userId}' was removed from the team, so it can't author a '${type}' link.`
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

    // At root link, team doesn't yet have members
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

  /** Unless I'm an admin, I can't remove anyone's devices but my own */
  canOnlyRemoveYourOwnDevices(...args) {
    const [previousState, link] = args
    const author = link.body.userId

    // Only admins can remove another user's devices
    const authorIsAdmin = select.memberIsAdmin(previousState, author)
    if (authorIsAdmin) return VALID

    if (link.body.type === 'REMOVE_DEVICE') {
      const target = link.body.payload.deviceId
      const device = select.device(previousState, target)
      const deviceOwner = device.userId
      if (author !== deviceOwner) {
        return fail("Can't remove another user's device.", ...args)
      }
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
    if (!authorIsAdmin) {
      if (link.body.type === 'CHANGE_MEMBER_KEYS') {
        const target = link.body.payload.keys.name
        if (author !== target) {
          return fail("Can't change another user's keys.", ...args)
        }
      } else if (link.body.type === 'CHANGE_SERVER_KEYS') {
        const target = link.body.payload.keys.name
        if (author !== target) {
          return fail("Can't change another server's keys.", ...args)
        }
      }
    }
    return VALID
  },

  /**
   * Granting someone a role has to hand them that role's keys.
   *
   * The reducer applies whatever lockboxes it's given and adds the role either way, so an
   * ADD_MEMBER_ROLE with an empty `lockboxes` array used to make `memberHasRole` return true for
   * someone holding none of the role's keys. Applications gate on that predicate, so authorization
   * would say yes while key possession says no.
   */
  roleGrantMustIncludeKeys(...args) {
    const [previousState, link] = args
    if (link.body.type !== 'ADD_MEMBER_ROLE') return VALID

    const { userId, roleName, lockboxes = [] } = link.body.payload

    // Any generation of the member's keys will do: their keys may have been rotated concurrently
    // with this grant, and a lockbox addressed to the superseded generation still reaches them
    const grantsRoleKeys = lockboxes.some(
      ({ contents, recipient }) =>
        contents.type === KeyType.ROLE &&
        contents.name === roleName &&
        recipient.type === KeyType.USER &&
        recipient.name === userId &&
        isRegisteredEncryptionKey(previousState, userId, recipient.publicKey)
    )

    if (!grantsRoleKeys) {
      const msg = `Adding '${userId}' to the '${roleName}' role requires a lockbox holding that role's keys for them.`
      return fail(msg, ...args)
    }

    return VALID
  },

  /** Check for ADMIT with invitations that are revoked OR have been used more than maxUses OR are expired */
  cantAdmitWithInvalidInvitation(...args) {
    const [previousState, link] = args
    if (link.body.type === 'ADMIT_MEMBER' || link.body.type === 'ADMIT_DEVICE') {
      const { id } = link.body.payload
      const invitation = select.getInvitation(previousState, id)
      return invitationCanBeUsed(invitation, link.body.timestamp)
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

    // The payload types describe what honest code produces; what actually arrived is either kind
    const invitation: Invitation | undefined =
      link.body.type === 'INVITE_MEMBER' || link.body.type === 'INVITE_DEVICE'
        ? link.body.payload.invitation
        : undefined

    if (invitation === undefined) return VALID

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
   * An admission can't name a userId or userName that the team has already seen — whether it
   * belongs to a current member or to one who has been removed.
   *
   * The removed half is what keeps a removal from being undone by replay. A proof of invitation is
   * published on the graph, so a removed member's proof is durably readable by everyone; and an
   * invitation with `maxUses` greater than one still has uses left after they're admitted. Without
   * this, any member — admin or not — could replay that proof together with the removed member's
   * public keys, putting them back on the team and handing them lockboxes for the current team
   * keys. Adding someone back is still possible through ADD_MEMBER, which is admin-only.
   */
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

      if (previousState.removedMembers.some(hasUserId)) {
        return fail('This userId belongs to a member who was removed from the team.', ...args)
      }

      if (previousState.removedMembers.some(hasUserName)) {
        return fail('This userName belongs to a member who was removed from the team.', ...args)
      }
    }
    return VALID
  },
}

const fail = (message: string, previousState: TeamState, link: TeamLink) => {
  message = truncateHashes(`${actionFingerprint(link)} ${message}`)
  log(message)
  return {
    isValid: false,
    error: new ValidationError(message, { prevState: previousState, link }),
  }
}
