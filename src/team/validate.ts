import { SignedLink, ValidationError, ValidationResult } from '../chain'
import * as selectors from './selectors'
import { TeamState } from './teamState'
import {
  TeamStateValidatorSet,
  ValidationArgs,
  TeamStateValidator,
} from './types'

export const validate: TeamStateValidator = (...args: ValidationArgs) => {
  for (const key in validators) {
    const validator = validators[key]
    const validation = validator(...args)
    if (!validation.isValid) return validation
  }
  return VALID
}

const validators: TeamStateValidatorSet = {
  /** check that the user who made these changes was admin at the time */
  mustBeAdmin: (...args) => {
    const [prevState, link] = args

    // At root stage, there are no members
    if (link.body.type !== 'ROOT') {
      const { userName } = link.body.context.user
      const isntAdmin = !selectors.memberIsAdmin(prevState, userName)
      if (isntAdmin)
        return fail(`Member '${userName}' is not an admin`, ...args)
    }
    return VALID
  },

  cantAddExistingMember: (...args) => {
    const [prevState, link] = args
    if (link.body.type === 'ADD_MEMBER') {
      const { userName } = link.body.payload.user
      if (selectors.hasMember(prevState, userName))
        return fail(`There is already a member called '${userName}'`, ...args)
    }
    return VALID
  },

  cantRemoveNonexistentMember: (...args) => {
    const [prevState, link] = args
    if (link.body.type === 'REVOKE_MEMBER') {
      const { userName } = link.body.payload
      if (!selectors.hasMember(prevState, userName))
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
