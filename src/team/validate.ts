import { SignedLink, ValidationError, ValidationResult } from '/chain'
import * as select from './selectors'
import { TeamState, TeamStateValidator, TeamStateValidatorSet, ValidationArgs } from '/team/types'

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
    const preMembershipActions = ['ROOT'] // team doesn't have members when these actions happen
    const nonAdminActions = ['ADMIT_INVITED_MEMBER'] // any team member can do these things

    if (!preMembershipActions.includes(type)) {
      const { userName } = context.user

      // make sure member exists
      const noSuchUser = !select.hasMember(prevState, userName)
      if (noSuchUser) return fail(`There is no member called '${userName}'`, ...args)

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
      const { userName } = link.body.payload.user
      if (select.hasMember(prevState, userName))
        return fail(`There is already a member called '${userName}'`, ...args)
    }
    return VALID
  },

  cantRemoveNonexistentMember: (...args) => {
    const [prevState, link] = args
    if (link.body.type === 'REVOKE_MEMBER') {
      const { userName } = link.body.payload
      if (!select.hasMember(prevState, userName))
        return fail(`There is no member called '${userName}'`, ...args)
    }
    return VALID
  },
}

const fail = (message: string, prevState: TeamState, link: SignedLink) => {
  const { index } = link.body
  return {
    isValid: false,
    error: new ValidationError(message, index, { prevState, link }),
  }
}

const VALID = { isValid: true } as ValidationResult
