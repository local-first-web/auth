import { type Base58 } from '@localfirst/crdx'
import { describe, expect, it } from 'vitest'
import { deriveSharedKey } from '../deriveSharedKey.js'
import { base58 } from '@localfirst/crypto'

describe('deriveSharedKey', () => {
  it('result should be the same regardless of order of parameters', () => {
    const aliceSecret = 'EfLuJLNo6hQPNaqvLHQq9Xc3KQNXJE2erWF4FQbuCZ8' as Base58
    const bobSecret = '5gby4eLBSChNvb6UxNVbUuJMKBNfTeqpi5xE27MDWibM' as Base58

    const aliceKey = deriveSharedKey(aliceSecret, bobSecret)
    const bobKey = deriveSharedKey(bobSecret, aliceSecret)

    expect(aliceKey).toEqual(bobKey)
  })

  it('works with byte arrays', () => {
    const aliceSecret = base58.decode('EfLuJLNo6hQPNaqvLHQq9Xc3KQNXJE2erWF4FQbuCZ8')
    const bobSecret = base58.decode('5gby4eLBSChNvb6UxNVbUuJMKBNfTeqpi5xE27MDWibM')

    const aliceKey = deriveSharedKey(aliceSecret, bobSecret)
    const bobKey = deriveSharedKey(bobSecret, aliceSecret)

    expect(aliceKey).toEqual(bobKey)
  })
})
