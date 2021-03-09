import {
  getCommonPredecessor,
  getHead,
  getPredecessors,
  isMergeLink,
  isPredecessor,
  SignedLink,
} from '@/chain'
import { buildChain, findByPayload, getPayloads } from '@/chain/testUtils'

/*
                     ┌─→ e ─→ g ─┐
  a ─→ b ─┬─→ c ─→ d ┴─→ f ───── * ── * ─→ o ── * ─→ n
          ├─→ h ─→ i ─────────────────┘         │
          └─→ j ─→ k ─→ l ──────────────────────┘
 */

const chain = buildChain()

describe('chains', () => {
  describe('predecessors', () => {
    describe('getPredecessors', () => {
      test('head', () => {
        const predecessors = getPayloads(getPredecessors(chain, getHead(chain))).sort() // ignore order
        const expected = 'a b c d e f g h i j k l o'.split(' ')
        expect(predecessors).toEqual(expected)
      })

      test('d', () => {
        const d = findByPayload(chain, 'd')
        const predecessors = getPayloads(getPredecessors(chain, d))
        expect(predecessors).toEqual('c b a'.split(' ')) // note correct order
      })

      test('o', () => {
        const o = findByPayload(chain, 'o')
        const predecessors = getPayloads(getPredecessors(chain, o)).sort() // ignore order
        expect(predecessors).toEqual('a b c d e f g h i'.split(' '))
      })
    })

    describe('isPredecessor', () => {
      const testCase = (a: string, b: string) => {
        const aLink = findByPayload(chain, a)
        const bLink = findByPayload(chain, b)

        return isPredecessor(chain, aLink, bLink)
      }

      test('c precedes f', () => expect(testCase('c', 'f')).toBe(true))
      test('c precedes d', () => expect(testCase('c', 'd')).toBe(true))
      test('c precedes n', () => expect(testCase('c', 'n')).toBe(true))
      test('a precedes n', () => expect(testCase('a', 'n')).toBe(true))

      test(`f doesn't precede c`, () => expect(testCase('f', 'c')).toBe(false))
      test(`n doesn't precede a`, () => expect(testCase('n', 'a')).toBe(false))
      test(`c doesn't precede c`, () => expect(testCase('c', 'c')).toBe(false))
      test(`c doesn't precede h`, () => expect(testCase('c', 'h')).toBe(false))
      test(`c doesn't precede l`, () => expect(testCase('c', 'l')).toBe(false))

      test(`nonexistent nodes don't precede anything`, () =>
        expect(testCase('nope', 'c')).toBe(false))

      test('merge nodes', () => {
        const links = Object.values(chain.links)

        const m = links.filter(isMergeLink)
        const c = findByPayload(chain, 'c')
        expect(isPredecessor(chain, c, m[0])).toBe(true)
        expect(isPredecessor(chain, c, m[1])).toBe(true)
        expect(isPredecessor(chain, c, m[2])).toBe(true)

        const l = findByPayload(chain, 'l')
        expect(isPredecessor(chain, l, m[0])).toBe(false)
        expect(isPredecessor(chain, l, m[1])).toBe(false)
        expect(isPredecessor(chain, l, m[2])).toBe(true)

        const i = findByPayload(chain, 'i')
        expect(isPredecessor(chain, i, m[0])).toBe(false)
        expect(isPredecessor(chain, i, m[1])).toBe(true)
        expect(isPredecessor(chain, i, m[2])).toBe(true)

        const n = findByPayload(chain, 'n')
        expect(isPredecessor(chain, n, m[0])).toBe(false)
        expect(isPredecessor(chain, n, m[1])).toBe(false)
        expect(isPredecessor(chain, n, m[2])).toBe(false)

        const a = findByPayload(chain, 'a')
        expect(isPredecessor(chain, a, m[0])).toBe(true)
        expect(isPredecessor(chain, a, m[1])).toBe(true)
        expect(isPredecessor(chain, a, m[2])).toBe(true)
      })
    })

    describe('getCommonPredecessor', () => {
      const testCase = (a: string, b: string) => {
        const chain = buildChain()
        const aLink = findByPayload(chain, a)
        const bLink = findByPayload(chain, b)
        const result = getCommonPredecessor(chain, aLink, bLink) as SignedLink<any, any>
        return result.body.payload
      }

      test('f g', () => expect(testCase('f', 'g')).toBe('d'))
      test('l o', () => expect(testCase('l', 'o')).toBe('b'))
      test('f f', () => expect(testCase('f', 'f')).toBe('f'))
      test('d f', () => expect(testCase('d', 'f')).toBe('d'))
      test('k l', () => expect(testCase('k', 'n')).toBe('k'))
    })
  })
})
