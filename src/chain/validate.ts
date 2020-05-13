import { SignatureChain, SignedLink } from './types'
import { hashLink } from './hashLink'
import { signatures } from '../lib'
import { baseLinkType } from './baseLinkType'

/**
 * Runs a signature chain through a series of validators to ensure that it has not been tampered with.
 * @chain The signature chain to validate
 */
export const validate = (chain: SignatureChain): ValidationResult => {
  const initialValue = { isValid: true } as ValidResult
  return chain.reduce(compose(validators), initialValue)
}

/**
 * Returns a single reducer function that runs all validators.
 * @param validators A map of validators
 */
const compose = (validators: ValidatorSet) => (
  result: ValidationResult,
  currentLink: SignedLink,
  i: number,
  chain: SignatureChain
) => {
  // short-circuit validation if any previous validation has failed
  if (result.isValid === false) return result as InvalidResult

  const prevLink = i === 0 ? undefined : chain[i - 1]
  for (const key in validators) {
    const validator = validators[key]
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

// VALIDATORS

type Validator = (
  currentLink: SignedLink,
  prevLink?: SignedLink
) => ValidationResult

const validators: ValidatorSet = {
  /** Does this link contain a hash of the previous link?  */
  validateHash: (currentLink, prevLink) => {
    const isFirstLink = prevLink === undefined
    if (isFirstLink) return { isValid: true } // nothing to validate on first link
    const expected = hashLink(prevLink!)
    const actual = currentLink.body.prev
    return actual === expected
      ? { isValid: true }
      : {
          isValid: false,
          error: new ValidationError(
            'Hash does not match previous link',
            currentLink.body.index,
            { actual, expected }
          ),
        }
  },

  /** If this is a root link, is it the first link in the chain? */
  validateRoot: (currentLink, prevLink) => {
    const { type } = currentLink.body
    const isRoot = type === baseLinkType.ROOT
    const isFirstLink = prevLink === undefined

    // both should be true, or both should be false
    if (isRoot === isFirstLink) return { isValid: true }
    else {
      const message = isRoot
        ? // has type ROOT but isn't first
          'The root link must be the first link in the signature chain.'
        : // is first but doesn't have type ROOT
          'The first link in the signature chain must be the root link. '
      return {
        isValid: false,
        error: new ValidationError(message, currentLink.body.index),
      }
    }
  },

  /** Does this link's signature check out? */
  validateSignatures: currentLink => {
    const signedMessage = {
      payload: currentLink.body,
      signature: currentLink.signed.signature,
      publicKey: currentLink.signed.key,
    }
    return signatures.verify(signedMessage)
      ? { isValid: true }
      : {
          isValid: false,
          error: new ValidationError(
            'Signature is not valid',
            currentLink.body.index,
            signedMessage
          ),
        }
  },

  /** Is this link's index consecutive to the previous link's index? */
  validateSequence: (currentLink, prevLink) => {
    const isFirstLink = prevLink === undefined
    const expected = isFirstLink
      ? 0 // first link should have index 0
      : (prevLink!.body.index || 0) + 1 // other links should increment previous by one
    const index = currentLink.body.index
    return index === expected
      ? { isValid: true }
      : {
          isValid: false,
          error: new ValidationError(
            'Index is not consecutive',
            currentLink.body.index,
            { actual: index, expected }
          ),
        }
  },
}

// TYPES

export type ValidatorSet = {
  [key: string]: Validator
}

export interface InvalidResult {
  isValid: false
  error: ValidationError
}

export interface ValidResult {
  isValid: true
}

export class ValidationError extends Error {
  constructor(message: string, index: number, details?: any) {
    super()
    this.message = message
    this.index = index
    this.details = details
  }

  public name: 'Signature chain validation error'
  public index?: number
  public details?: any
}

export type ValidationResult = ValidResult | InvalidResult
