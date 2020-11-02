import { concat } from 'ramda'
import { append, create, SignedNode } from '.'
import { getSequence, Reconciler } from './getSequence'
import { buildGraph, findByPayload, getPayloads } from './testUtils'
import { defaultContext } from '/util/testing'

describe('getSequence', () => {
  test('upon creation', () => {
    var graph = create('a', defaultContext)
    const sequence = getSequence(graph)
    expect(getPayloads(sequence)).toEqual(['a'])
  })

  test('no branches', () => {
    var graph = create('a', defaultContext)
    graph = append(graph, { type: 'FOO', payload: 'b' }, defaultContext)
    graph = append(graph, { type: 'FOO', payload: 'c' }, defaultContext)
    const sequence = getSequence(graph)
    expect(getPayloads(sequence)).toEqual(['a', 'b', 'c'])
  })

  test('provide root & head', () => {
    const graph = buildGraph()
    const j = findByPayload(graph, 'j')
    const q = findByPayload(graph, 'q')
    const sequence = getSequence(graph, { root: j, head: q })
    expect(getPayloads(sequence)).toEqual(['j', 'p', 'q'])
  })

  test('complex graph', () => {
    const graph = buildGraph()
    const sequence = getSequence(graph)
    const expected = ['a', 'b', 'j', 'p', 'q', 'h', 'i', 'c', 'd', 'f', 'e', 'o', 'l', 'n']
    expect(getPayloads(sequence)).toEqual(expected)
  })

  test('complex graph with custom reconciler', () => {
    const graph = buildGraph()

    const reconciler: Reconciler = (a, b) => {
      const [_a, _b] = [a, b].sort() // ensure deterministic order
      // rule 1: q goes first
      // rule 2: e is omitted
      const merged = _a.concat(_b) as SignedNode[]
      return merged
        .filter(n => n.body.payload === 'q')
        .concat(merged.filter(n => n.body.payload !== 'e' && n.body.payload !== 'q'))
    }
    const sequence = getSequence(graph, { reconciler })

    const expected = ['a', 'b', 'q', 'j', 'p', 'h', 'i', 'c', 'd', 'f', 'o', 'l', 'n']
    expect(getPayloads(sequence)).toEqual(expected)
  })
})
