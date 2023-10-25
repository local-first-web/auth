import { describe, expect, it } from 'vitest'
import { type Base58 } from '../types.js'
import { base58 } from './base58.js'
import { keyToBytes } from './keyToBytes.js'

describe('base58', () => {
  describe('detect', () => {
    it('recognizes a base58 string', () => {
      expect(base58.detect('5VbnBWz6kBnV2wfJZaPgv81Mj7QtAsPmq3QZgc3z1eKYnnG3KSHtCD67')).toBe(true)
    })

    it('doesnt recognize a non-base58 string', () => {
      expect(base58.detect('1 can be confused with I and l')).toBe(false)
    })
  })
})

describe('keyToBytes', () => {
  it('converts a base58 string to bytes', () => {
    const key =
      '5VbnBWz6kBnV2wfJZaPgv81Mj7QtAsPmq3QZgc3zZqbYZEzEdZQ9r24BGZpN6mt6djyr7W2v1eKYnnG3KSHtCD67' as Base58
    const bytes = keyToBytes(key)

    expect(bytes instanceof Uint8Array).toBe(true)
    expect(bytes).toHaveLength(64)
  })

  it('converts a utf8 string to bytes', () => {
    const key = 'abcdef'
    const bytes = keyToBytes(key, 'utf8')

    expect(bytes instanceof Uint8Array).toBe(true)
    expect(bytes).toHaveLength(6)
  })
})
