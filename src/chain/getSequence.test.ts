import { buildChain, findByPayload, getPayloads } from '/chain/testUtils'
import { Action, append, create, getSequence, Resolver, SignedLink } from '/chain'
import { defaultContext } from '/util/testing'
import { arbitraryDeterministicSort } from './arbitraryDeterministicSort'
import { randomKey } from '@herbcaudill/crypto'

const randomResolver: Resolver<any> = (a, b) => {
  // change the hash key on each run, to ensure our tests aren't bound to one arbitrary sort
  const hashKey = randomKey()
  const [_a, _b] = [a, b].sort(arbitraryDeterministicSort(hashKey))
  return _a.concat(_b)
}

const resolver = randomResolver

describe('chains', () => {
  describe('getSequence', () => {
    test('upon creation', () => {
      var chain = create<any>('a', defaultContext)
      const sequence = getSequence<any>({ chain, resolver })
      expect(getPayloads(sequence)).toEqual(['a'])
    })

    test('no branches', () => {
      var chain = create<any>('a', defaultContext)
      chain = append(chain, { type: 'FOO', payload: 'b' }, defaultContext)
      chain = append(chain, { type: 'FOO', payload: 'c' }, defaultContext)
      const sequence = getSequence({ chain, resolver })

      const expected = 'a b c'

      expect(getPayloads(sequence)).toEqual(split(expected))
    })

    /*                      ┌─→ e ─→ g ─┐
         a ─→ b ─┬─→ c ─→ d ┴─→ f ───── * ── * ─→ o ── * ─→ n
                 ├─→ h ─→ i ─────────────────┘         │
                 └─→ j ─→ k ─→ l ──────────────────────┘           */

    describe('complex chain', () => {
      const chain = buildChain()

      test('full sequence', () => {
        const sequence = getSequence({ chain, resolver })

        // the resolved sequence will be one of these
        const expected = [
          'a b   j k l   c d f e g   h i   o n',
          'a b   j k l   c d e g f   h i   o n',

          'a b   j k l   h i   c d f e g   o n',
          'a b   j k l   h i   c d e g f   o n',

          'a b   h i   c d f e g   j k l   o n',
          'a b   h i   c d e g f   j k l   o n',

          'a b   h i   c d f e g  o  j k l   n',
          'a b   h i   c d e g f  o  j k l   n',

          'a b   c d f e g   h i  o  j k l   n',
          'a b   c d e g f   h i  o  j k l   n',

          'a b   c d f e g   h i   j k l   o n',
          'a b   c d e g f   h i   j k l   o n',
        ].map(split)

        expect(expected).toContainEqual(getPayloads(sequence))
      })

      test('root', () => {
        const b = findByPayload(chain, 'b')
        const sequence = getSequence({ chain, root: b, resolver })

        const expected = [
          'b   j k l   c d f e g   h i   o n',
          'b   j k l   c d e g f   h i   o n',

          'b   j k l   h i   c d f e g   o n',
          'b   j k l   h i   c d e g f   o n',

          'b   h i   c d f e g   j k l   o n',
          'b   h i   c d e g f   j k l   o n',

          'b   h i   c d f e g  o  j k l   n',
          'b   h i   c d e g f  o  j k l   n',

          'b   c d f e g   h i  o  j k l   n',
          'b   c d e g f   h i  o  j k l   n',

          'b   c d f e g   h i   j k l   o n',
          'b   c d e g f   h i   j k l   o n',
        ].map(split)

        expect(expected).toContainEqual(getPayloads(sequence))
      })

      test('head', () => {
        const d = findByPayload(chain, 'd')
        const sequence = getSequence({ chain, head: d, resolver })

        const expected = 'a b c d'

        expect(getPayloads(sequence)).toEqual(split(expected))
      })

      test('root & head', () => {
        const j = findByPayload(chain, 'j')
        const l = findByPayload(chain, 'l')
        const sequence = getSequence({ chain, root: j, head: l, resolver })

        const expected = 'j k l'

        expect(getPayloads(sequence)).toEqual(split(expected))
      })

      test('root within a branch', () => {
        const c = findByPayload(chain, 'c')
        const sequence = getSequence({ chain, root: c, resolver })

        const expected = [
          'c d   e g   f   o n', //
          'c d   f   e g   o n',
        ].map(split)

        expect(expected).toContainEqual(getPayloads(sequence))
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
