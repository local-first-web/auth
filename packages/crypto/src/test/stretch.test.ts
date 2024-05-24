import { describe, expect, test } from 'vitest'
import { stretch } from '../index.js'
import { base58 } from '../util/index.js'

describe('stretch', () => {
  test('returns a 32-byte key', () => {
    const password = 'hello123'
    const key = stretch(password)

    expect(key).toHaveLength(32)

    // Results are deterministic
    expect(base58.encode(key)).toMatchInlineSnapshot(
      '"8hYkvmB2xxdjzi7ZL7DNKXUFEDHsAHWs66fMXYkpdDWr"'
    )
  })
})
