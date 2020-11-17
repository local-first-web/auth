import { buildChain, getPayloads, findByPayload } from './testUtils'
import { getPredecessors, getCommonPredecessor } from '/chain/getPredecessors'
import { getHead } from '/chain/getHead'
import { SignedLink } from '/chain/types'

describe('getPredecessors', () => {
  it('head', () => {
    const chain = buildChain()
    const predecessors = getPayloads(getPredecessors(chain, getHead(chain))).sort() // ignore order
    expect(predecessors).toEqual(
      ['a', 'b', 'c', 'd', 'e', 'f', 'h', 'i', 'j', 'l', 'o', 'p', 'q'].sort()
    )
  })

  it('d', () => {
    const chain = buildChain()
    const d = findByPayload(chain, 'd')
    const predecessors = getPayloads(getPredecessors(chain, d))
    expect(predecessors).toEqual(['c', 'b', 'a']) // note correct order
  })

  it('l', () => {
    const chain = buildChain()
    const l = findByPayload(chain, 'l')
    const predecessors = getPayloads(getPredecessors(chain, l)).sort() // ignore order
    expect(predecessors).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'h', 'i', 'o'].sort())
  })
})

describe('getCommonPredecessor', () => {
  const testCase = (a: string, b: string) => {
    const chain = buildChain()
    const aLink = findByPayload(chain, a)
    const bLink = findByPayload(chain, b)
    return (getCommonPredecessor(chain, aLink, bLink) as SignedLink<any>).body.payload
  }

  test('o/f', () => expect(testCase('o', 'f')).toBe('d'))
  test('l/q', () => expect(testCase('l', 'q')).toBe('b'))
})
