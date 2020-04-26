import { stretch } from '.'

describe('crypto', () => {
  describe('stretch', () => {
    test('returns a 32-byte key', () => {
      const password = 'hello123'
      const key = stretch(password)
      expect(key).toHaveLength(32)
    })
  })
})
