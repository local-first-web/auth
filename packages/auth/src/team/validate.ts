import { ROOT } from '@localfirst/crdx'
import { isAdminOnlyAction } from './isAdminOnlyAction.js'
import * as select from './selectors/index.js'
import {
  type TeamLink,
  type TeamState,
  type TeamStateValidator,
  type TeamStateValidatorSet,
  type ValidationArgs,
} from './types.js'
import { parseDeviceId } from '@/device/index.js'
import { invitationCanBeUsed } from '@/invitation/index.js'
import { actionFingerprint, debug, truncateHashes, VALID, ValidationError } from '@/util/index.js'

const log = debug('lf:auth:validate')

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
  /** The user who made these changes was a member with appropriate rights at the time */
  mustBeAdmin(...args) {
    const [previousState, link] = args
    const action = link.body
    const { type, userId } = action

    // At root link, team doesn't yet have members
    if (type === ROOT) {
      return VALID
    }

    if (isAdminOnlyAction(action)) {
      const isntAdmin = !select.memberIsAdmin(previousState, userId)
      if (isntAdmin) {
        return fail(`Member '${userId}' is not an admin`, ...args)
      }
    }

    return VALID
  },

  // TODO: the public key that this is encrypted with should be the author's public encryption key at that time.
  // signatureKeyIsCorrect: (...args) => {
  //   const [prevState, link] = args
  //   const action = link.body
  //   const { type } = action

  //   // at root link, team doesn't yet have members
  //   if (type === ROOT) return VALID

  //   const { userId } = link.signed
  //   const author = select.member(prevState, userId)
  //   // TODO: test this case
  //   if (link.signed.key !== author.keys.signature) {
  //     const msg = `Wrong signature key. Link is signed with ${link.signed.key}, but ${userId}'s signature key is ${author.keys.signature}`
  //     return fail(msg, ...args)
  //   }
  //   return VALID
  // },

  canOnlyChangeYourOwnKeys(...args) {
    const [previousState, link] = args
    const author = link.body.userId
    const authorIsAdmin = select.memberIsAdmin(previousState, author)
    if (!authorIsAdmin) {
      if (link.body.type === 'CHANGE_MEMBER_KEYS') {
        const target = link.body.payload.keys.name
        // Only admins can change another user's keys
        if (author !== target) {
          return fail("Can't change another user's keys.", ...args)
        }
      } else if (link.body.type === 'CHANGE_DEVICE_KEYS') {
        const target = parseDeviceId(link.body.payload.keys.name).userId
        if (author !== target) {
          return fail("Can't change another user's device keys.", ...args)
        }
      }
    }

    return VALID
  },

  // Check for ADMIT with invitations that are revoked OR have been used more than maxUses OR are expired
  cantAdmitWithInvalidInvitation(...args) {
    const [previousState, link] = args
    if (link.body.type === 'ADMIT_MEMBER' || link.body.type === 'ADMIT_DEVICE') {
      const { id } = link.body.payload
      const invitation = select.getInvitation(previousState, id)
      return invitationCanBeUsed(invitation, link.body.timestamp)
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
