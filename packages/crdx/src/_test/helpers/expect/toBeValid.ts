import { ValidationResult } from '/validator'

// ignore coverage
expect.extend({
  toBeValid(validation: ValidationResult, expectedMessage?: string) {
    if (validation.isValid)
      return {
        message: () => 'expected validation not to pass',
        pass: true,
      }
    else {
      if (expectedMessage && !new RegExp(expectedMessage).test(validation.error.message))
        return {
          message: () =>
            `expected validation to fail with message ${expectedMessage}, but got ${validation.error.message}`,
          pass: true,
        }
      else
        return {
          message: () => validation.error.message,
          pass: false,
        }
    }
  },
})
