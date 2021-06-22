import { actionFingerprint, ROOT, TeamActionLink } from '@/chain'
import { parseDeviceId } from '@/device'
import { invitationCanBeUsed } from '@/invitation'
import * as select from '@/team/selectors'
import { TeamState, TeamStateValidator, TeamStateValidatorSet, ValidationArgs } from '@/team/types'
import { debug, truncateHashes, VALID, ValidationError } from '@/util'
import { isAdminOnlyAction } from '../chain/isAdminOnlyAction'
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
    const { type, context } = action
    const { userName } = context.member

    // at root link, team doesn't yet have members
    if (type === ROOT) return VALID

    if (isAdminOnlyAction(action)) {
      const isntAdmin = !select.memberIsAdmin(prevState, userName)
      if (isntAdmin) return fail(`Member '${userName}' is not an admin`, ...args)
    }

    return VALID
  },

  /** the key that the link is signed with must be the author's signature key at that time */
  signatureKeyIsCorrect: (...args) => {
    const [prevState, link] = args
    const action = link.body
    const { type } = action

    // at root link, team doesn't yet have members
    if (type === ROOT) return VALID

    const { userName } = link.signed
    const author = select.member(prevState, userName)
    // TODO: test this case
    if (link.signed.key !== author.keys.signature) {
      const msg = `Wrong signature key. Link is signed with ${link.signed.key}, but ${userName}'s signature key is ${author.keys.signature}`
      return fail(msg, ...args)
    }
    return VALID
  },

  cantAddExistingMember: (...args) => {
    const [prevState, link] = args
    if (link.body.type === 'ADD_MEMBER') {
      const { userName: name } = link.body.payload.member
      if (select.hasMember(prevState, name))
        return fail(`There is already a member called '${name}'`, ...args)
    }
    return VALID
  },

  cantRemoveNonexistentMember: (...args) => {
    const [prevState, link] = args
    if (link.body.type === 'REMOVE_MEMBER') {
      const { userName } = link.body.payload
      if (!select.hasMember(prevState, userName))
        return fail(`A member named '${userName}' was not found`, ...args)
    }
    return VALID
  },

  canOnlyChangeYourOwnKeys: (...args) => {
    const [prevState, link] = args
    if (link.body.type === 'CHANGE_MEMBER_KEYS') {
      const author = link.signed.userName
      const authorIsAdmin = select.memberIsAdmin(prevState, author)
      if (!authorIsAdmin) {
        // Only admins can change another user's keys
        const target = link.body.payload.keys.name
        if (author !== target) return fail(`Can't change another user's keys.`, ...args)
      }
    } else if (link.body.type === 'CHANGE_DEVICE_KEYS') {
      const authorUserName = link.signed.userName
      const authorDeviceName = link.body.context.device.deviceName
      // Devices can only change their own keys
      const target = parseDeviceId(link.body.payload.keys.name)
      if (authorUserName !== target.userName || authorDeviceName !== target.deviceName)
        return fail(`Can't change another device's keys.`, ...args)
    }
    return VALID
  },

  cantAddExistingDevice: (...args) => {
    const [prevState, link] = args
    if (link.body.type === 'ADD_DEVICE') {
      const { device } = link.body.payload
      const { deviceName, userName } = device
      const member = select.member(prevState, userName)
      const { devices = [] } = member
      // TODO: test this case
      if (devices.find(d => d.deviceName === deviceName))
        return fail(`The member ${userName} already has a device named '${deviceName}'`, ...args)
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

const fail = (message: string, prevState: TeamState, link: TeamActionLink) => {
  message = truncateHashes(`${actionFingerprint(link)} ${message}`)
  log(message)
  return {
    isValid: false,
    error: new ValidationError(message, { prevState, link }),
  }
}
