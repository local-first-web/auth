import { pack } from 'msgpackr'
import { describe, expect, it } from 'vitest'
import { hash, hashBytes } from '..'
import { base58, keyToBytes } from '../util/index.js'

describe('crypto', () => {
  describe('hashBytes', () => {
    const payload = pack('one if by day, two if by night')

    it('(bytes) has the correct length', () => {
      const h = hashBytes('TEST_HASH_PURPOSE', payload)
      expect(h.length).toBe(32)
    })

    it('(bytes) results are deterministic', () => {
      const h = hashBytes('TEST_HASH_PURPOSE', payload)
      const encoded = base58.encode(h)
      expect(encoded).toMatchInlineSnapshot('"XHgALgKKPhbnBZ81hJx4aszEU5uoF8hg4m8TidP2F1E"')
    })

    it('(bytes) gives different results with different seeds', () => {
      const hash1 = hashBytes('SOMETHING', payload)
      const hash2 = hashBytes('SOMETHING_ELSE', payload)
      expect(hash2).not.toEqual(hash1)
    })
  })

  describe('hash', () => {
    const payload = 'one if by day, two if by night'

    it('has the correct length', () => {
      const h = hash(payload, 'TEST_HASH_PURPOSE')
      expect(keyToBytes(h).length).toBe(32)
    })

    it('results are deterministic', () => {
      const h = hash(payload, 'TEST_HASH_PURPOSE')
      expect(h).toMatchInlineSnapshot('"14rA39xtqMBQjd3oGekYjaiqK8qsdfQqSF69zdThvVz4"')
    })

    it('gives different results with different seeds', () => {
      const hash1 = hash(payload, 'SOMETHING')
      const hash2 = hash(payload, 'SOMETHING_ELSE')
      expect(hash2).not.toEqual(hash1)
    })
  })
})
