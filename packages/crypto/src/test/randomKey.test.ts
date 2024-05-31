import { describe, expect, it } from 'vitest'
import { randomKey, randomKeyBytes } from '../index.js'

describe('randomKey', () => {
  it('should return keys of the expected length', () => {
    expect(randomKey()).toHaveLength(16)
    expect(randomKey(8)).toHaveLength(8)
    expect(randomKeyBytes()).toHaveLength(32)
    expect(randomKeyBytes(16)).toHaveLength(16)
  })
})
