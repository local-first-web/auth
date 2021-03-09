import { signatures } from '@herbcaudill/crypto'
import { getRoot } from '@/chain/getRoot'
import { hashLink } from '@/chain/hashLink'
import {
  isMergeLink,
  isRootLink,
  NonRootLinkBody,
  ROOT,
  RootLinkBody,
  ValidatorSet,
} from '@/chain/types'
import { debug, memoize, ValidationError } from '@/util'

const log = debug('lf:auth:validators')

const _validators: ValidatorSet = {
  /** Does this link contain a hash of the previous link?  */
  validateHash: (link, chain) => {
    if (isRootLink(link)) return { isValid: true } // nothing to validate on first link
    const prevHashes = isMergeLink(link) ? link.body : [(link.body as NonRootLinkBody<any>).prev]
    for (const hash of prevHashes) {
      const prevLink = chain.links[hash]!
      const expected = hashLink(prevLink.body)
      if (hash !== expected) {
        return {
          isValid: false,
          error: new ValidationError('Hash does not match previous link', {
            link,
            hash,
            expected,
          }),
        }
      }
    }
    return { isValid: true }
  },

  /** If this is a root link, is it the first link in the chain? */
  validateRoot: (link, chain) => {
    const hasNoPreviousLink = isRootLink(link)
    const hasRootType = (link.body as RootLinkBody<any>).type === ROOT
    const isDesignatedAsRoot = getRoot(chain) === link
    // all should be true, or all should be false
    if (hasNoPreviousLink === isDesignatedAsRoot && isDesignatedAsRoot === hasRootType)
      return { isValid: true }
    else {
      // TODO there are more possibilities - sort them all out?
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
const memoizeFunctionMap = (source: ValidatorSet) => {
  const result = {} as ValidatorSet
  for (const key in source) result[key] = memoize(source[key])
  return result
}

export const validators = memoizeFunctionMap(_validators)
