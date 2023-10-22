import { describe, expect, it } from 'vitest'
import { randomKey } from '..'
import { keyToBytes } from '../util'

describe('randomKey', () => {
  it('should return keys of the expected length', () => {
    expect(keyToBytes(randomKey())).toHaveLength(32)
    expect(keyToBytes(randomKey(16))).toHaveLength(16)
  })
})
