import { signatures } from '@herbcaudill/crypto'
import { EMPTY_CHAIN } from './create'
import { hashNode } from './hashNode'
import { LocalUserContext, redactContext } from '/context'
import { NodeBody, SignatureChain, SignedNode } from '/chain'

export const append = <T extends NodeBody>(
  chain: SignatureChain<T> | typeof EMPTY_CHAIN,
  node: Partial<T>,
  context: LocalUserContext
): SignatureChain<T> => {
  // chain to previous head
  const body = {
    ...node,
    context: redactContext(context),
    timestamp: new Date().getTime(),
    prev: chain.head,
  } as T

  const { userName, keys } = context.user
  const hash = hashNode(body)

  // attach signature
  const signedNode = {
    body,
    hash,
    signed: {
      userName,
      signature: signatures.sign(body, keys.signature.secretKey),
      key: keys.signature.publicKey,
    },
  } as SignedNode<T>

  // clone the previous map of nodes
  const nodes = new Map(chain.nodes)
  nodes.set(hash, signedNode)

  // return new chain
  const root = chain.root ?? hash // if the root is null, this was the first node
  const head = hash
  return { root, head, nodes } as SignatureChain<T>
}
