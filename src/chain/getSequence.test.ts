import { append, create, SignedNode } from '.'
import { getSequence, Reconciler } from './getSequence'
import { buildChain, findByPayload, getPayloads } from './testUtils'
import { defaultContext } from '/util/testing'

describe('getSequence', () => {
  test('upon creation', () => {
    var chain = create('a', defaultContext)
    const sequence = getSequence(chain)
    expect(getPayloads(sequence)).toEqual(['a'])
  })

  test('no branches', () => {
    var chain = create('a', defaultContext)
    chain = append(chain, { type: 'FOO', payload: 'b' }, defaultContext)
    chain = append(chain, { type: 'FOO', payload: 'c' }, defaultContext)
    const sequence = getSequence(chain)
    expect(getPayloads(sequence)).toEqual(['a', 'b', 'c'])
  })

  test('provide root & head', () => {
    const chain = buildChain()
    const j = findByPayload(chain, 'j')
    const q = findByPayload(chain, 'q')
    const sequence = getSequence(chain, { root: j, head: q })
    expect(getPayloads(sequence)).toEqual(['j', 'p', 'q'])
  })

  test('complex chain', () => {
    const chain = buildChain()
    const sequence = getSequence(chain)
    const expected = ['a', 'b', 'j', 'p', 'q', 'h', 'i', 'c', 'd', 'f', 'e', 'o', 'l', 'n']
    expect(getPayloads(sequence)).toEqual(expected)
  })

  test('complex chain with custom reconciler', () => {
    const chain = buildChain()

    const reconciler: Reconciler = (a, b) => {
      const [_a, _b] = [a, b].sort() // ensure deterministic order
      // rule 1: q goes first
      // rule 2: e is omitted
      const merged = _a.concat(_b) as SignedNode<any>[]
      return merged
        .filter(n => n.body.payload === 'q')
        .concat(merged.filter(n => n.body.payload !== 'e' && n.body.payload !== 'q'))
    }
    const sequence = getSequence(chain, { reconciler })

    const expected = ['a', 'b', 'q', 'j', 'p', 'h', 'i', 'c', 'd', 'f', 'o', 'l', 'n']
    expect(getPayloads(sequence)).toEqual(expected)
  })
})
