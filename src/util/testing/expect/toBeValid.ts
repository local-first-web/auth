import { ValidationResult } from '/util/types'

expect.extend({
  toBeValid(validation: ValidationResult) {
    if (validation.isValid)
      return {
        message: () => 'expected validation not to pass',
        pass: true,
      }
    else
      return {
        message: () => validation.error.message,
        pass: false,
      }
  },
  toLookLikeKeyset(maybeKeyset: any) {
    const looksLikeKeyset =
      maybeKeyset.hasOwnProperty('encryption') && maybeKeyset.hasOwnProperty('signature')
    if (looksLikeKeyset)
      return {
        message: () => 'expected not to look like a keyset',
        pass: true,
      }
    else
      return {
        message: () => 'expected to look like a keyset',
        pass: false,
      }
  },
})
