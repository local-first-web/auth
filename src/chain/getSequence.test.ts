import { randomKey } from '@herbcaudill/crypto'
import { arbitraryDeterministicSort } from './arbitraryDeterministicSort'
import { append, create, getSequence, Sequencer } from '/chain'
import { buildChain, findByPayload, getPayloads } from '/chain/testUtils'
import { setup } from '/util/testing'

const { alice } = setup(['alice'])
const defaultContext = alice.localContext

const randomSequencer: Sequencer = (a, b) => {
  // change the hash key on each run, to ensure our tests aren't bound to one arbitrary sort
  const hashKey = randomKey()
  const [_a, _b] = [a, b].sort(arbitraryDeterministicSort(hashKey))
  return _a.concat(_b)
}

const sequencer = randomSequencer

describe('chains', () => {
  describe('getSequence', () => {
    test('upon creation', () => {
      var chain = create('a', defaultContext)
      const sequence = getSequence({ chain, sequencer })
      expect(getPayloads(sequence)).toEqual(['a'])
    })

    test('no branches', () => {
      var chain = create('a', defaultContext)
      chain = append(chain, { type: 'FOO', payload: 'b' }, defaultContext)
      chain = append(chain, { type: 'FOO', payload: 'c' }, defaultContext)
      const sequence = getSequence({ chain, sequencer })

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
        const sequence = getSequence({ chain, sequencer })

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
        const sequence = getSequence<any>({ chain, root: b, sequencer })

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
        const sequence = getSequence<any>({ chain, head: d, sequencer })

        const expected = 'a b c d'

        expect(getPayloads(sequence)).toEqual(split(expected))
      })

      test('root & head', () => {
        const j = findByPayload(chain, 'j')
        const l = findByPayload(chain, 'l')
        const sequence = getSequence<any>({ chain, root: j, head: l, sequencer })

        const expected = 'j k l'

        expect(getPayloads(sequence)).toEqual(split(expected))
      })

      test('root within a branch', () => {
        const c = findByPayload(chain, 'c')
        const sequence = getSequence<any>({ chain, root: c, sequencer })

        const expected = [
          'c d   e g   f   o n', //
          'c d   f   e g   o n',
        ].map(split)

        expect(expected).toContainEqual(getPayloads(sequence))
      })

      // TODO: reenable this test
      //   test('custom sequencer', () => {
      //     const sequencer: sequencer = (a, b) => {
      //       const [_a, _b] = [a, b].sort() // ensure deterministic order

      //       // rule 1: `i`s go first
      //       // rule 2: `e`s are omitted
      //       const merged = _a.concat(_b) as SignedLink<any, any>[]
      //       return merged
      //         .filter(n => n.body.payload === 'i')
      //         .concat(merged.filter(n => n.body.payload !== 'e' && n.body.payload !== 'i'))
      //     }

      //     const sequence = getSequence({ chain, sequencer })

      //     // note that `i` comes first and `e` is omitted
      //     const expected = 'a b   i    j k l   h   c d f g    o n'

      //     expect(getPayloads(sequence)).toEqual(split(expected))
      //   })
    })
  })
})

// split on whitespace
const split = (s: string) => s.split(/\s*/)
