import { base58, hash } from '@herbcaudill/crypto'
import { makeHash } from './ProbabilisticFilter'
import { TruncatedHashFilter } from './TruncatedHashFilter'

describe('Truncated hash filter', () => {
  it('2 values', () => {
    const filter = new TruncatedHashFilter({ resolution: 3 }).add(['a', 'b'])

    // no false negatives
    expect(filter.has('a')).toBe(true)
    expect(filter.has('b')).toBe(true)

    // no false positives
    expect(filter.has('c')).toBe(false)
    expect(filter.has('d')).toBe(false)
  })

  it('2 hashes', () => {
    const a = makeHash('a')
    const b = makeHash('b')
    const c = makeHash('c')
    const d = makeHash('d')

    const filter = new TruncatedHashFilter({ resolution: 3 }).addHashes([a, b])

    // no false negatives
    expect(filter.hasHash(a)).toBe(true)
    expect(filter.hasHash(b)).toBe(true)

    // no false positives
    expect(filter.hasHash(c)).toBe(false)
    expect(filter.hasHash(d)).toBe(false)
  })

  it('many consecutive items', () => {
    const N = 10000
    const numbers = range(N)

    const filter = new TruncatedHashFilter().add(numbers)

    // no false negatives
    for (const n of numbers) {
      expect(filter.has(n)).toBe(true)
    }

    // few false positives
    const moreNumbers = range(N).map(n => n + N)
    const falsePositives = moreNumbers.filter(n => filter.has(n)).length
    expect(falsePositives / N).toBeLessThan(0.0001)
  })

  it('many random items', () => {
    const N = 10000
    const numbers = range(N)

    const filter = new TruncatedHashFilter().add(numbers)

    // no false negatives
    for (const n of numbers) {
      expect(filter.has(n)).toBe(true)
    }

    // few false positives
    const moreNumbers = range(N).map(n => n + N)
    const falsePositives = moreNumbers.filter(n => filter.has(n)).length
    expect(falsePositives / N).toBeLessThan(0.0001)
  })

  it('save/rehydrate round trip', () => {
    const N = 10
    const numbers = range(N)

    const filter = new TruncatedHashFilter().add(numbers)

    // store or transmit the filter's value
    const storedValue = filter.save()

    // rehydrate from the stored value
    const newFilter = new TruncatedHashFilter().load(storedValue)

    // the saved values match
    expect(newFilter.save()).toEqual(storedValue)
  })

  it('10 items, testing with rehydrated filter', () => {
    const N = 10
    const numbers = range(N)

    const filter = new TruncatedHashFilter().add(numbers)

    // store or transmit the filter's value
    const storedValue = filter.save()

    const newFilter = new TruncatedHashFilter().load(storedValue)

    // no false negatives
    for (const n of numbers) {
      expect(newFilter.has(n)).toBe(true)
    }

    // no false positives
    const moreNumbers = range(N).map(n => n + N)
    for (const n of moreNumbers) {
      expect(newFilter.has(n)).toBe(false)
    }
  })
})

const range = (size: number): string[] => [...Array(size).keys()].map(n => n.toString())
