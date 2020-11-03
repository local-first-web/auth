import {
  isMergeNode,
  isRootNode,
  NodeBody,
  NonRootNodeBody,
  RootNodeBody,
  ValidatorSet,
} from '/chain/types'
import { ValidationError } from '/util'
import { hashNode } from '/chain/hashNode'
import { signatures } from '@herbcaudill/crypto'
import { getRoot } from './getRoot'

export const validators: ValidatorSet = {
  /** Does this link contain a hash of the previous link?  */
  validateHash: (node, chain) => {
    if (isRootNode(node)) return { isValid: true } // nothing to validate on first link
    const prevHashes = isMergeNode(node) ? node.body : [(node.body as NonRootNodeBody).prev]
    for (const hash of prevHashes) {
      const prevNode = chain.nodes.get(hash)!
      const expected = hashNode(prevNode.body)
      const actual = hash
      if (expected !== actual) {
        console.log({ node, prevNode, expected, actual })
        return {
          isValid: false,
          error: new ValidationError('Hash does not match previous link', {
            node,
            expected,
            actual,
          }),
        }
      }
    }
    return { isValid: true }
  },

  /** If this is a root link, is it the first link in the chain? */
  validateRoot: (node, chain) => {
    const hasNoPreviousNode = isRootNode(node)
    const hasRootType = (node.body as RootNodeBody).type === 'ROOT'
    const isDesignatedAsRoot = getRoot(chain) === node
    // all should be true, or all should be false
    if (hasNoPreviousNode === isDesignatedAsRoot && isDesignatedAsRoot === hasRootType)
      return { isValid: true }
    else {
      // TODO sort out all these possibilities?
      const message = hasNoPreviousNode
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
  validateSignatures: node => {
    if (isMergeNode(node)) return { isValid: true } // merge nodes aren't signed

    const signedMessage = {
      payload: node.body,
      signature: node.signed.signature,
      publicKey: node.signed.key,
    }
    return signatures.verify(signedMessage)
      ? { isValid: true }
      : {
          isValid: false,
          error: new ValidationError('Signature is not valid', signedMessage),
        }
  },
}
