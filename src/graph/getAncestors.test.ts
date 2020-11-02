import { buildGraph, getPayloads, findByPayload } from './testUtils'
import { getAncestors, getCommonAncestor } from '/graph/getAncestors'
import { getHead } from '/graph/getHead'
import { SignedNode } from '/graph/types'

describe('getAncestors', () => {
  it('head', () => {
    const graph = buildGraph()
    const ancestors = getPayloads(getAncestors(graph, getHead(graph))).sort() // ignore order
    expect(ancestors).toEqual(
      ['a', 'b', 'c', 'd', 'e', 'f', 'h', 'i', 'j', 'l', 'o', 'p', 'q'].sort()
    )
  })

  it('d', () => {
    const graph = buildGraph()
    const d = findByPayload(graph, 'd')
    const ancestors = getPayloads(getAncestors(graph, d))
    expect(ancestors).toEqual(['c', 'b', 'a']) // note correct order
  })

  it('l', () => {
    const graph = buildGraph()
    const l = findByPayload(graph, 'l')
    const ancestors = getPayloads(getAncestors(graph, l)).sort() // ignore order
    expect(ancestors).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'h', 'i', 'o'].sort())
  })
})

describe('getCommonAncestor', () => {
  const testCase = (a: string, b: string) => {
    const graph = buildGraph()
    const aNode = findByPayload(graph, a)
    const bNode = findByPayload(graph, b)
    return (getCommonAncestor(graph, aNode, bNode) as SignedNode).body.payload
  }

  test('o/f', () => expect(testCase('o', 'f')).toBe('d'))
  test('l/q', () => expect(testCase('l', 'q')).toBe('b'))
})
