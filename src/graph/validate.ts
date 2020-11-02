import { getSequence } from './getSequence'
import { GraphNode, NodeBody } from './types'
import { SignatureGraph, ValidatorSet } from '/graph'
import { validators } from '/graph/validators'
import { InvalidResult, ValidationResult } from '/util'

const VALID = { isValid: true } as ValidationResult

/**
 * Runs a signature graph through a series of validators to ensure that it is correctly formed, has
 * not been tampered with, etc.
 * @graph The signature graph to validate
 * @customValidators Any additional validators (besides the base validators that test the graph's
 * integrity)
 */
export const validate = <T extends NodeBody>(
  graph: SignatureGraph<T>,
  customValidators: ValidatorSet = {}
): ValidationResult => {
  /**
   * Returns a single reducer function that runs all validators.
   * @param validators A map of validators
   */
  const composeValidators = (...validators: ValidatorSet[]) => (
    result: ValidationResult,
    currentLink: GraphNode<T>
  ) => {
    const mergedValidators = merge(validators)
    // short-circuit validation if any previous validation has failed
    if (result.isValid === false) return result as InvalidResult

    for (const key in mergedValidators) {
      const validator = mergedValidators[key]
      try {
        const result = validator(currentLink, graph)
        if (result.isValid === false) return result
      } catch (e) {
        // any errors thrown cause validation to fail and are returned with the validation result
        // ignore coverage
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
  return getSequence(graph).reduce(v, initialValue)
}
