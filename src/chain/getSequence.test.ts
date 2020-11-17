import { append } from './append'
import { create } from './create'
import { Resolver, SignedLink } from './types'
import { getSequence } from './getSequence'
import { buildChain, findByPayload, getPayloads } from './testUtils'
import { defaultContext } from '/util/testing'

describe('chains', () => {
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

    /*
                        ┌─→ e ─→ g ─┐
      a ─→ b ─┬─→ c ─→ d ┴─→ f ───── * ── * ─→ o ── * ─→ n
              ├─→ h ─→ i ─────────────────┘         │
              └─→ j ─→ k ─→ l ──────────────────────┘
    */

    describe('complex chain', () => {
      const chain = buildChain()

      test('full sequence', () => {
        const sequence = getSequence(chain)
        const expected = 'a b j k l c d f e g h i o n'.split(' ')
        expect(getPayloads(sequence)).toEqual(expected)
      })

      test('provide root', () => {
        const b = findByPayload(chain, 'b')
        const sequence = getSequence(chain, { root: b })
        const expected = 'b j k l c d f e g h i o n'.split(' ')
        expect(getPayloads(sequence)).toEqual(expected)
      })

      test('provide head', () => {
        const d = findByPayload(chain, 'd')
        const sequence = getSequence(chain, { head: d })
        expect(getPayloads(sequence)).toEqual('a b c d'.split(' '))
      })

      test('provide root & head', () => {
        const j = findByPayload(chain, 'j')
        const l = findByPayload(chain, 'l')
        const sequence = getSequence(chain, { root: j, head: l })
        expect(getPayloads(sequence)).toEqual(['j', 'k', 'l'])
      })

      test('provide root within a branch', () => {
        const c = findByPayload(chain, 'c')
        const sequence = getSequence(chain, { root: c })
        expect(getPayloads(sequence).sort()).toEqual('c d e f g n o'.split(' '))
      })

      test('custom resolver', () => {
        const resolver: Resolver = (a, b) => {
          const [_a, _b] = [a, b].sort() // ensure deterministic order
          // rule 1: l goes first
          // rule 2: e is omitted
          const merged = _a.concat(_b) as SignedLink<any>[]
          return merged
            .filter(n => n.body.payload === 'l')
            .concat(merged.filter(n => n.body.payload !== 'e' && n.body.payload !== 'l'))
        }
        const sequence = getSequence(chain, { resolver })

        const expected = 'a b l j k h i c d f g o n'.split(' ')
        expect(getPayloads(sequence)).toEqual(expected)
      })
    })
  })
})
