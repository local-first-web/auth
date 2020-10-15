import { stretch } from '/crypto/stretch'
import { keyToBytes } from '/util'

describe('stretch', () => {
  test('returns a 32-byte key', () => {
    const password = 'hello123'
    const key = stretch(password)
    expect(key).toHaveLength(32)
  })

  test('takes a byte array as as password', () => {
    const password = keyToBytes('hello123')
    const key = stretch(password)
    expect(key).toHaveLength(32)
  })
})
