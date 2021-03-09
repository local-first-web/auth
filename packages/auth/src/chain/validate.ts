import { getSequence } from '@/chain/getSequence'
import { Action, Link, SignatureChain, ValidatorSet } from '@/chain/types'
import { validators } from '@/chain/validators'
import { InvalidResult, VALID, ValidationResult } from '@/util'

/**
 * Runs a signature chain through a series of validators to ensure that it is correctly formed, has
 * not been tampered with, etc.
 * @chain The signature chain to validate
 * @customValidators Any additional validators (besides the base validators that test the chain's
 * integrity)
 */
export const validate = <A extends Action>(
  chain: SignatureChain<A>,
  customValidators: ValidatorSet = {}
): ValidationResult => {
  /**
   * Returns a single reducer function that runs all validators.
   * @param validators A map of validators
   */
  const composeValidators = (...validators: ValidatorSet[]) => (
    result: ValidationResult,
    currentLink: Link<A>
  ) => {
    const mergedValidators = merge(validators)
    // short-circuit validation if any previous validation has failed
    if (result.isValid === false) return result as InvalidResult

    for (const key in mergedValidators) {
      const validator = mergedValidators[key]
      try {
        const result = validator(currentLink, chain)
        if (result.isValid === false) return result
      } catch (e) {
        // any errors thrown cause validation to fail and are returned with the validation result
        return {
          isValid: false,
          error: { message: e.message, details: e },
        } as InvalidResult
      }
    }
    // no validators failed
    return VALID
  }

  // merges multiple validator sets into one object
  const merge = (validatorSets: ValidatorSet[]) =>
    validatorSets.reduce((result, vs) => Object.assign(result, vs), {})

  const initialValue = VALID
  const v = composeValidators(validators, customValidators)
  return getSequence({ chain }).reduce(v, initialValue)
}
