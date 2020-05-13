import {
  InvalidResult,
  SignatureChain,
  SignedLink,
  ValidationResult,
  ValidatorSet,
  ValidResult,
} from './types'
import { validators as baseValidators } from './validators'

/**
 * Runs a signature chain through a series of validators to ensure that it is correctly formed, has
 * not been tampered with, etc.
 * @chain The signature chain to validate
 * @customValidators Any additional validators (besides the base validators that test the chain's
 * integrity)
 */
export const validate = (
  chain: SignatureChain,
  customValidators: ValidatorSet = {}
): ValidationResult => {
  const initialValue = { isValid: true } as ValidResult
  return chain.reduce(
    composeValidators(baseValidators, customValidators),
    initialValue
  )
}

/**
 * Returns a single reducer function that runs all validators.
 * @param validators A map of validators
 */
const composeValidators = (...validators: ValidatorSet[]) => (
  result: ValidationResult,
  currentLink: SignedLink,
  i: number,
  chain: SignatureChain
) => {
  const mergedValidators = merge(validators)
  // short-circuit validation if any previous validation has failed
  if (result.isValid === false) return result as InvalidResult
  const prevLink = i === 0 ? undefined : chain[i - 1]
  for (const key in mergedValidators) {
    const validator = mergedValidators[key]
    try {
      const result = validator(currentLink, prevLink)
      if (result.isValid === false) return result
    } catch (e) {
      // any errors thrown cause validation to fail and are returned with the validation result
      return {
        isValid: false,
        error: { message: e.message, index: i, details: e },
      } as InvalidResult
    }
  }
  // no validators failed
  return { isValid: true } as ValidResult
}

// merges multiple validator sets into one object
const merge = (validatorSets: ValidatorSet[]) =>
  validatorSets.reduce((result, vs) => Object.assign(result, vs), {})
