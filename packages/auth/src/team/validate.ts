import { invitationCanBeUsed } from '@/invitation'
import { actionFingerprint, debug, truncateHashes, VALID, ValidationError } from '@/util'
import { ROOT } from 'crdx'
import { isAdminOnlyAction } from './isAdminOnlyAction'
import * as select from './selectors'
import {
  TeamLink,
  TeamState,
  TeamStateValidator,
  TeamStateValidatorSet,
  ValidationArgs,
} from './types'

const log = debug('lf:auth:validate')

export const validate: TeamStateValidator = (...args: ValidationArgs) => {
  for (const key in validators) {
    const validator = validators[key]
    const validation = validator(...args)
    if (!validation.isValid) return validation
  }
  return VALID
}

const validators: TeamStateValidatorSet = {
  /** the user who made these changes was a member with appropriate rights at the time */
  mustBeAdmin: (...args) => {
    const [prevState, link] = args
    const action = link.body
    const { type, userId } = action

    // at root link, team doesn't yet have members
    if (type === ROOT) return VALID

    if (isAdminOnlyAction(action)) {
      const isntAdmin = !select.memberIsAdmin(prevState, userId)
      if (isntAdmin) return fail(`Member '${userId}' is not an admin`, ...args)
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

  canOnlyChangeYourOwnKeys: (...args) => {
    const [prevState, link] = args
    if (link.body.type === 'CHANGE_MEMBER_KEYS') {
      const author = link.body.userId
      const authorIsAdmin = select.memberIsAdmin(prevState, author)
      if (!authorIsAdmin) {
        // Only admins can change another user's keys
        const target = link.body.payload.keys.name
        if (author !== target) return fail(`Can't change another user's keys.`, ...args)
      }
    } else if (link.body.type === 'CHANGE_DEVICE_KEYS') {
      return VALID
      // TODO: we don't have device information in context any more
      //
      // const authoruserId = link.signed.userId
      // const authorDeviceName = link.body.context.device.deviceName
      // // Devices can only change their own keys
      // const target = parseDeviceId(link.body.payload.keys.name)
      // if (authoruserId !== target.userId || authorDeviceName !== target.deviceName)
      //   return fail(`Can't change another device's keys.`, ...args)
    }
    return VALID
  },

  // check for ADMIT with invitations that are revoked OR have been used more than maxUses OR are expired
  cantAdmitWithInvalidInvitation: (...args) => {
    const [prevState, link] = args
    if (link.body.type === 'ADMIT_MEMBER' || link.body.type === 'ADMIT_DEVICE') {
      const { id } = link.body.payload
      const invitation = select.getInvitation(prevState, id)
      return invitationCanBeUsed(invitation, link.body.timestamp)
    }
    return VALID
  },
}

const fail = (message: string, prevState: TeamState, link: TeamLink) => {
  message = truncateHashes(`${actionFingerprint(link)} ${message}`)
  log(message)
  return {
    isValid: false,
    error: new ValidationError(message, { prevState, link }),
  }
}
