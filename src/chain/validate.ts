import {
  InvalidResult,
  SignatureChain,
  SignedLink,
  ValidationResult,
  ValidatorSet,
  ValidResult,
} from './types'

import { validators } from './validators'
/**
 * Runs a signature chain through a series of validators to ensure that it has not been tampered with.
 * @chain The signature chain to validate
 */
export const validate = (
  chain: SignatureChain,
  additionalValidators: ValidatorSet
): ValidationResult => {
  const initialValue = { isValid: true } as ValidResult
  return chain.reduce(
    composeValidators(validators, additionalValidators),
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
      // errors cause validation to fail
      return {
        isValid: false,
        error: { message: e.message, index: i, details: e },
      } as InvalidResult
    }
  }
  // no validators failed
  return { isValid: true } as ValidResult
}

const merge = (validatorSets: ValidatorSet[]) =>
  validatorSets.reduce(
    (result, validatorSet) => Object.assign(result, validatorSet),
    {} as ValidatorSet
  )
