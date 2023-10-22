import { describe, expect, test } from 'vitest'
import { stretch } from '..'
import { base58 } from '../util'

describe('stretch', () => {
  test('returns a 32-byte key', () => {
    const password = 'hello123'
    const key = stretch(password)

    expect(key).toHaveLength(32)

    // results are deterministic
    expect(base58.encode(key)).toMatchInlineSnapshot(
      `"B4WBEeoH1NQGiNjKLQ4vi9wtbBskG7sTpL4Tpy8EksCU"`
    )
  })
})
