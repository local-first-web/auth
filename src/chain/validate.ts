import { SignatureChain, SignedLink } from './types'
import { hashLink } from './hashLink'
import { signatures } from '../lib'

interface ValidationResult {
  isValid: boolean
  error?: {
    message: string
    index?: number
    details?: any
  }
}

/**
 * Runs a signature chain through a series of validators to ensure that it has not been tampered with.
 * @chain The signature chain to validate
 */
export const validate = (chain: SignatureChain): ValidationResult => {
  const initialValue = { isValid: true }
  return chain.reduce(
    compose([validateSequence, validateHash, validateSignatures]),
    initialValue
  )
}

/**
 * Returns a reducer function that runs all validators on each link in a signature chain.
 * @param validators An array of validator functions
 */
const compose = (validators: Validator[]) => (
  result: ValidationResult,
  currentLink: SignedLink,
  i: number,
  chain: SignatureChain
) => {
  // short-circuit validation if any previous validation has failed
  if (result.isValid === false) return result

  const prevLink = i === 0 ? undefined : chain[i - 1]
  for (const validator of validators)
    try {
      const result = validator(currentLink, prevLink)
      if (result.isValid === false) return result
    } catch (e) {
      // errors cause validation to fail
      return {
        isValid: false,
        error: {
          message: e.message,
          index: i,
          details: e,
        },
      }
    }

  // no validators failed
  return { isValid: true }
}

// VALIDATORS

type Validator = (
  currentLink: SignedLink,
  prevLink?: SignedLink
) => ValidationResult

/** Does this link contain a hash of the previous link?  */
const validateHash: Validator = (currentLink, prevLink) => {
  const isFirstLink = prevLink === undefined
  if (isFirstLink) return { isValid: true } // nothing to validate on first link
  const expected = hashLink(prevLink!)
  const actual = currentLink.body.prev
  const isValid = actual === expected
  const error = !isValid
    ? {
        message: 'Hash does not match previous link',
        index: currentLink.body.index,
        details: { actual, expected },
      }
    : undefined
  return { isValid, error }
}

/** Does this link's signature check out? */
const validateSignatures: Validator = currentLink => {
  const signedMessage = {
    payload: currentLink.body,
    signature: currentLink.signed.signature,
    publicKey: currentLink.signed.key,
  }
  const isValid = signatures.verify(signedMessage)
  const error = !isValid
    ? {
        message: 'Signature is not valid',
        index: currentLink.body.index,
        details: signedMessage,
      }
    : undefined
  return { isValid, error }
}

/** Is this link's index consecutive to the previous link's index? */
const validateSequence: Validator = (currentLink, prevLink) => {
  const isFirstLink = prevLink === undefined
  const expected = isFirstLink
    ? 0 // first link should have index 0
    : (prevLink!.body.index || 0) + 1 // other links should increment previous by one
  const index = currentLink.body.index
  const isValid = index === expected
  const error = !isValid
    ? {
        message: `Index is not consecutive`,
        index,
        details: { actual: index, expected },
      }
    : undefined
  return { isValid, error }
}
