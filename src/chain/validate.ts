import { SignatureChain, SignedLink } from './types'
import { hashLink } from './hashLink'
import { signatures } from '../lib'

/**
 * Runs a signature chain through a series of validators to ensure that it has not been tampered with.
 * @chain The signature chain to validate
 */
export const validate = (chain: SignatureChain) =>
  chain.reduce(
    compose([validateSequence, validateHash, validateSignatures]),
    true // innocent until proven guilty
  )

/**
 * Returns a reducer function that runs all validators on each link in a signature chain.
 * @param validators An array of validator functions
 */
const compose = (validators: Validator[]) => (
  isValid: boolean,
  currentLink: SignedLink,
  i: number,
  chain: SignatureChain
) => {
  // short-circuit validation if any previous validation has failed
  if (isValid === false) return false

  const prevLink = i === 0 ? undefined : chain[i - 1]
  for (const validator of validators)
    if (validator(currentLink, prevLink) === false) return false

  // no validators failed
  return true
}

// VALIDATORS

type Validator = (currentLink: SignedLink, prevLink?: SignedLink) => boolean

/** Does this link contain a hash of the previous link?  */
const validateHash: Validator = (currentLink, prevLink) => {
  const isFirstLink = prevLink === undefined
  if (isFirstLink) return true // nothing to validate on first link
  const expected = hashLink(prevLink!)
  return currentLink.body.prev === expected
}

/** Does this link's signature check out? */
const validateSignatures: Validator = currentLink =>
  signatures.verify({
    payload: currentLink.body,
    signature: currentLink.signed.signature,
    publicKey: currentLink.signed.key,
  })

/** Is this link's index consecutive to the previous link's index? */
const validateSequence: Validator = (currentLink, prevLink) => {
  const isFirstLink = prevLink === undefined
  const expected = isFirstLink
    ? 0 // first link should have index 0
    : (prevLink!.body.index || 0) + 1 // other links should increment previous by one
  return currentLink.body.index === expected
}
