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
      const sequence = getSequence({ chain })
      expect(getPayloads(sequence)).toEqual(['a'])
    })

    test('no branches', () => {
      var chain = create('a', defaultContext)
      chain = append(chain, { type: 'FOO', payload: 'b' }, defaultContext)
      chain = append(chain, { type: 'FOO', payload: 'c' }, defaultContext)
      const sequence = getSequence({ chain })

      const expected = 'a b c'

      expect(getPayloads(sequence)).toEqual(split(expected))
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
        const sequence = getSequence({ chain })

        const expected = 'a b   j k l   c d f e g   h i   o n'

        expect(getPayloads(sequence)).toEqual(split(expected))
      })

      test('root', () => {
        const b = findByPayload(chain, 'b')
        const sequence = getSequence({ chain, root: b })

        const expected = 'b   j k l   c d f e g   h i   o n'

        expect(getPayloads(sequence)).toEqual(split(expected))
      })

      test('head', () => {
        const d = findByPayload(chain, 'd')
        const sequence = getSequence({ chain, head: d })

        const expected = 'a b c d'

        expect(getPayloads(sequence)).toEqual(split(expected))
      })

      test('root & head', () => {
        const j = findByPayload(chain, 'j')
        const l = findByPayload(chain, 'l')
        const sequence = getSequence({ chain, root: j, head: l })

        const expected = 'j k l'

        expect(getPayloads(sequence)).toEqual(split(expected))
      })

      test('root within a branch', () => {
        const c = findByPayload(chain, 'c')
        const sequence = getSequence({ chain, root: c })

        const expected = 'c    d f e g   o n'

        expect(getPayloads(sequence)).toEqual(split(expected))
      })

      test('custom resolver', () => {
        const resolver: Resolver = (a, b) => {
          const [_a, _b] = [a, b].sort() // ensure deterministic order

          // rule 1: `i`s go first
          // rule 2: `e`s are omitted
          const merged = _a.concat(_b) as SignedLink<any, any>[]
          return merged
            .filter(n => n.body.payload === 'i')
            .concat(merged.filter(n => n.body.payload !== 'e' && n.body.payload !== 'i'))
        }

        const sequence = getSequence({ chain, resolver })

        // note that `i` comes first and `e` is omitted
        const expected = 'a b   i    j k l   h   c d f g    o n'

        expect(getPayloads(sequence)).toEqual(split(expected))
      })
    })
  })
})

// split on whitespace
const split = (s: string) => s.split(/\s*/)
