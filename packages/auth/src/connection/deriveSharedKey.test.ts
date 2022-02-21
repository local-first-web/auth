import { deriveSharedKey } from './deriveSharedKey'

describe('deriveSharedKey', () => {
  it('result should be the same regardless of order of parameters', () => {
    const aliceSecret = 'EfLuJLNo6hQPNaqvLHQq9Xc3KQNXJE2erWF4FQbuCZ8'
    const bobSecret = '5gby4eLBSChNvb6UxNVbUuJMKBNfTeqpi5xE27MDWibM'

    const aliceKey = deriveSharedKey(aliceSecret, bobSecret)
    const bobKey = deriveSharedKey(bobSecret, aliceSecret)

    expect(aliceKey).toEqual(bobKey)
  })
})
