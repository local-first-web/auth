import {
  isMergeLink,
  isRootLink,
  LinkBody,
  NonRootLinkBody,
  RootLinkBody,
  ValidatorSet,
} from '/chain/types'
import { ValidationError } from '/util'
import { hashLink } from '/chain/hashLink'
import { signatures } from '@herbcaudill/crypto'
import { getRoot } from './getRoot'

export const validators: ValidatorSet = {
  /** Does this link contain a hash of the previous link?  */
  validateHash: (link, chain) => {
    if (isRootLink(link)) return { isValid: true } // nothing to validate on first link
    const prevHashes = isMergeLink(link) ? link.body : [(link.body as NonRootLinkBody).prev]
    for (const hash of prevHashes) {
      const prevLink = chain.links[hash]!
      const expected = hashLink(prevLink.body)
      const actual = hash
      if (expected !== actual) {
        console.log({ link, prevLink, expected, actual })
        return {
          isValid: false,
          error: new ValidationError('Hash does not match previous link', {
            link,
            expected,
            actual,
          }),
        }
      }
    }
    return { isValid: true }
  },

  /** If this is a root link, is it the first link in the chain? */
  validateRoot: (link, chain) => {
    const hasNoPreviousLink = isRootLink(link)
    const hasRootType = (link.body as RootLinkBody).type === 'ROOT'
    const isDesignatedAsRoot = getRoot(chain) === link
    // all should be true, or all should be false
    if (hasNoPreviousLink === isDesignatedAsRoot && isDesignatedAsRoot === hasRootType)
      return { isValid: true }
    else {
      // TODO sort out all these possibilities?
      const message = hasNoPreviousLink
        ? // has type ROOT but isn't first
          'The root link must be the first link in the signature chain.'
        : // is first but doesn't have type ROOT
          'The first link in the signature chain must be the root link. '
      return {
        isValid: false,
        error: new ValidationError(message),
      }
    }
  },

  /** Does this link's signature check out? */
  validateSignatures: link => {
    if (isMergeLink(link)) return { isValid: true } // merge links aren't signed

    const signedMessage = {
      payload: link.body,
      signature: link.signed.signature,
      publicKey: link.signed.key,
    }
    return signatures.verify(signedMessage)
      ? { isValid: true }
      : {
          isValid: false,
          error: new ValidationError('Signature is not valid', signedMessage),
        }
  },
}
