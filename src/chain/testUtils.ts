import { append } from '/chain/append'
import { clone } from '/chain/clone'
import { create } from '/chain/create'
import { merge } from '/chain/merge'
import { ChainLink, isMergeLink, LinkBody, SignatureChain, SignedLink } from '/chain/types'
import { defaultContext } from '/util/testing'

export const getPayloads = (sequence: ChainLink<any>[]) =>
  sequence.filter(n => !isMergeLink(n)).map(n => (n.body as LinkBody).payload)

export const findByPayload = (chain: SignatureChain<any>, payload: any) => {
  const links = Object.values(chain.links)
  return links.find(n => !isMergeLink(n) && n.body.payload === payload) as SignedLink<any>
}

/**
 * Returns a chain with these links and branches (`*` = merge link):
 *
 *```
 *                   ┌─→ e ─→ o ─┐
 *a ─→ b ─┬─→ c ─→ d ┴─→ f ───── * ── * ─→ l ── * ─→ n
 *        ├─→ h ─→ i ─────────────────┘         │
 *        └─→ j ─→ p ─→ q ──────────────────────┘
 *```
 */
export const buildChain = () => {
  const appendLink = (chain: SignatureChain<any>, payload: string) =>
    append(chain, { type: 'X', payload }, defaultContext)

  var a = create('a', defaultContext)
  a = appendLink(a, 'b')

  // 3 branches from b:
  var b1 = clone(a)
  var b2 = clone(a)
  var b3 = clone(a)

  b1 = appendLink(b1, 'c')
  b1 = appendLink(b1, 'd')

  // 2 branches from d:
  var d1 = clone(b1)
  var d2 = clone(b1)

  d1 = appendLink(d1, 'e')
  d1 = appendLink(d1, 'o')

  d2 = appendLink(d2, 'f')

  b1 = merge(d1, d2) // *fo

  b2 = appendLink(b2, 'h')
  b2 = appendLink(b2, 'i')

  b1 = merge(b1, b2) // *ix

  b1 = appendLink(b1, 'l')

  b3 = appendLink(b3, 'j')
  b3 = appendLink(b3, 'p')
  b3 = appendLink(b3, 'q')

  a = merge(b1, b3) // *lq

  a = appendLink(a, 'n')

  return a
}
