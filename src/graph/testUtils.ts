import { append } from '/graph/append'
import { clone } from '/graph/clone'
import { create } from '/graph/create'
import { merge } from '/graph/merge'
import { GraphNode, isMergeNode, NodeBody, SignatureGraph, SignedNode } from '/graph/types'
import { defaultContext } from '/util/testing'

export const getPayloads = (sequence: GraphNode[]) =>
  sequence.filter(n => !isMergeNode(n)).map(n => (n.body as NodeBody).payload)

export const findByPayload = (graph: SignatureGraph, payload: any) =>
  [...graph.nodes.values()].find(n => !isMergeNode(n) && n.body.payload === payload) as SignedNode

/**
 * Returns a graph with these nodes and branches (`*` = merge node):
 *
 *```
 *                   ┌─→ e ─→ o ─┐
 *a ─→ b ─┬─→ c ─→ d ┴─→ f ───── * ── * ─→ l ── * ─→ n
 *        ├─→ h ─→ i ─────────────────┘         │
 *        └─→ j ─→ p ─→ q ──────────────────────┘
 *```
 */
export const buildGraph = () => {
  const appendNode = (g: SignatureGraph, payload: string) =>
    append(g, { type: 'X', payload }, defaultContext)

  var a = create('a', defaultContext)
  a = appendNode(a, 'b')

  // 3 branches from b:
  var b1 = clone(a)
  var b2 = clone(a)
  var b3 = clone(a)

  b1 = appendNode(b1, 'c')
  b1 = appendNode(b1, 'd')

  // 2 branches from d:
  var d1 = clone(b1)
  var d2 = clone(b1)

  d1 = appendNode(d1, 'e')
  d1 = appendNode(d1, 'o')

  d2 = appendNode(d2, 'f')

  b1 = merge(d1, d2) // *fo

  b2 = appendNode(b2, 'h')
  b2 = appendNode(b2, 'i')

  b1 = merge(b1, b2) // *ix

  b1 = appendNode(b1, 'l')

  b3 = appendNode(b3, 'j')
  b3 = appendNode(b3, 'p')
  b3 = appendNode(b3, 'q')

  a = merge(b1, b3) // *lq

  a = appendNode(a, 'n')

  return a
}