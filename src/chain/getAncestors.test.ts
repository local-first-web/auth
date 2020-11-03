import { buildChain, getPayloads, findByPayload } from './testUtils'
import { getAncestors, getCommonAncestor } from '/chain/getAncestors'
import { getHead } from '/chain/getHead'
import { SignedNode } from '/chain/types'

describe('getAncestors', () => {
  it('head', () => {
    const chain = buildChain()
    const ancestors = getPayloads(getAncestors(chain, getHead(chain))).sort() // ignore order
    expect(ancestors).toEqual(
      ['a', 'b', 'c', 'd', 'e', 'f', 'h', 'i', 'j', 'l', 'o', 'p', 'q'].sort()
    )
  })

  it('d', () => {
    const chain = buildChain()
    const d = findByPayload(chain, 'd')
    const ancestors = getPayloads(getAncestors(chain, d))
    expect(ancestors).toEqual(['c', 'b', 'a']) // note correct order
  })

  it('l', () => {
    const chain = buildChain()
    const l = findByPayload(chain, 'l')
    const ancestors = getPayloads(getAncestors(chain, l)).sort() // ignore order
    expect(ancestors).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'h', 'i', 'o'].sort())
  })
})

describe('getCommonAncestor', () => {
  const testCase = (a: string, b: string) => {
    const chain = buildChain()
    const aNode = findByPayload(chain, a)
    const bNode = findByPayload(chain, b)
    return (getCommonAncestor(chain, aNode, bNode) as SignedNode<any>).body.payload
  }

  test('o/f', () => expect(testCase('o', 'f')).toBe('d'))
  test('l/q', () => expect(testCase('l', 'q')).toBe('b'))
})
