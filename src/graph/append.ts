import { signatures } from '@herbcaudill/crypto'
import { EMPTY_GRAPH } from './create'
import { hashNode } from './hashNode'
import { LocalUserContext, redactContext } from '/context'
import { NodeBody, SignatureGraph, SignedNode } from '/graph'

export const append = <T extends NodeBody>(
  graph: SignatureGraph | typeof EMPTY_GRAPH,
  node: Partial<T>,
  context: LocalUserContext
): SignatureGraph<T> => {
  // chain to previous head
  const body = {
    ...node,
    context: redactContext(context),
    timestamp: new Date().getTime(),
    prev: graph.head,
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
  const nodes = new Map(graph.nodes)
  nodes.set(hash, signedNode)

  // return new graph
  const root = graph.root ?? hash // if the root is null, this was the first node
  const head = hash
  return { root, head, nodes } as SignatureGraph<T>
}
