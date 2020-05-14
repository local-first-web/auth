import { SignedLink, ValidationError } from '../chain'
import * as selectors from './selectors'
import { TeamState } from './teamState'
import { linkType } from './types'
import { ValidationResult } from '../chain'

const VALID = { isValid: true } as ValidationResult

export const validate = (prevState: TeamState, link: SignedLink) => {
  for (const key in validators) {
    const validator = validators[key]
    const validation = validator(prevState, link)
    if (!validation.isValid) return validation
  }
  return VALID
}

type TeamStateValidator = (
  prevState: TeamState,
  link: SignedLink
) => ValidationResult

/** check that the user who made these changes was admin at the time */

const validators: { [key: string]: TeamStateValidator } = {
  validateAdminUser: (prevState, link) => {
    const { type, context, index } = link.body

    if (type !== linkType.ROOT) {
      const { userName } = context.user
      const isntAdmin = !selectors.memberIsAdmin(prevState, userName)
      if (isntAdmin)
        return {
          isValid: false,
          error: new ValidationError(
            `Invalid signature chain: member '${userName}' is not an admin at this time`,
            index,
            { prevState, link }
          ),
        }
    }
    return VALID
  },
}
