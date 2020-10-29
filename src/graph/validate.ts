// import { SignatureGraph, SignedNode, ValidatorSet } from '/graph'
// import { validators } from '/graph/validators'
// import { ValidationResult, InvalidResult } from '/util'

// const VALID = { isValid: true } as ValidationResult

// /**
//  * Runs a signature graph through a series of validators to ensure that it is correctly formed, has
//  * not been tampered with, etc.
//  * @graph The signature graph to validate
//  * @customValidators Any additional validators (besides the base validators that test the graph's
//  * integrity)
//  */
// export const validate = (
//   graph: SignatureGraph,
//   customValidators: ValidatorSet = {}
// ): ValidationResult => {
//   const initialValue = VALID
//   // return graph.reduce(composeValidators(validators, customValidators), initialValue)
// }

// /**
//  * Returns a single reducer function that runs all validators.
//  * @param validators A map of validators
//  */
// const composeValidators = (...validators: ValidatorSet[]) => (
//   result: ValidationResult,
//   currentNode: SignedNode,
//   i: number,
//   graph: SignatureGraph
// ) => {
//   const mergedValidators = merge(validators)
//   // short-circuit validation if any previous validation has failed
//   if (result.isValid === false) return result as InvalidResult
//   const prevNode = i === 0 ? undefined : graph[i - 1]
//   for (const key in mergedValidators) {
//     const validator = mergedValidators[key]
//     try {
//       const result = validator(currentNode, prevNode)
//       if (result.isValid === false) return result
//     } catch (e) {
//       // any errors thrown cause validation to fail and are returned with the validation result
//       return {
//         isValid: false,
//         error: { message: e.message, index: i, details: e },
//       } as InvalidResult
//     }
//   }
//   // no validators failed
//   return VALID
// }

// // merges multiple validator sets into one object
// const merge = (validatorSets: ValidatorSet[]) =>
//   validatorSets.reduce((result, vs) => Object.assign(result, vs), {})
