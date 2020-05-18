import { ValidatorSet, ValidationError } from '/chain/types'
import { hashLink } from '/chain/hashLink'
import { signatures } from '/crypto'

export const validators: ValidatorSet = {
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
          error: new ValidationError('Hash does not match previous link', currentLink.body.index, {
            actual,
            expected,
          }),
        }
  },

  /** If this is a root link, is it the first link in the chain? */
  validateRoot: (currentLink, prevLink) => {
    const { type } = currentLink.body
    const isRoot = type === 'ROOT'
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
          error: new ValidationError('Index is not consecutive', currentLink.body.index, {
            actual: index,
            expected,
          }),
        }
  },
}
