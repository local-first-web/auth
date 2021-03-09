import { ValidationResult } from '@/util/types'

// ignore coverage
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
})
