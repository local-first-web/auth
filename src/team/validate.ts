import { ActionLink, ROOT } from '/chain'
import { KeyScope } from '/keyset'
import * as select from '/team/selectors'
import { TeamState, TeamStateValidator, TeamStateValidatorSet, ValidationArgs } from '/team/types'
import { VALID, ValidationError } from '/util'

export const validate: TeamStateValidator = (...args: ValidationArgs) => {
  for (const key in validators) {
    const validator = validators[key]
    const validation = validator(...args)
    if (!validation.isValid) return validation
  }
  return VALID
}

const validators: TeamStateValidatorSet = {
  /** check that the user who made these changes was a member with appropriate rights at the time */
  mustBeAdmin: (...args) => {
    const [prevState, link] = args

    const { type, context } = link.body

    // any team member can do these things
    const nonAdminActions = ['ADD_DEVICE', 'CHANGE_MEMBER_KEYS', 'ADMIT']

    // at root link, team doesn't yet have members
    if (type !== ROOT) {
      const { userName } = context.member

      // make sure member exists
      const noSuchMember = !select.hasMember(prevState, userName)
      if (noSuchMember) {
        console.error(
          'member not found',
          prevState.members.map((m) => m.userName),
          link
        )
        return fail(`A member named '${userName}' was not found`, ...args)
      }

      if (!nonAdminActions.includes(type)) {
        // make sure member is admin
        const isntAdmin = !select.memberIsAdmin(prevState, userName)
        if (isntAdmin) return fail(`Member '${userName}' is not an admin`, ...args)
      }
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
      const linkAuthorScope = { type: 'MEMBER', name: link.signed.userName } as KeyScope

      // TODO
    }
    return VALID
  },

  cantAddExistingDevice: (...args) => {
    const [prevState, link] = args
    if (link.body.type === 'ADD_DEVICE') {
      const { device } = link.body.payload
      const { deviceId, userName } = device
      const member = select.member(prevState, userName)
      const { devices = [] } = member
      if (devices.find((d) => d.deviceId === deviceId))
        return fail(`The member ${userName} already has a device with id '${deviceId}'`, ...args)
    }
    return VALID
  },
}

const fail = (message: string, prevState: TeamState, link: ActionLink<any>) => {
  return {
    isValid: false,
    error: new ValidationError(message, { prevState, link }),
  }
}
