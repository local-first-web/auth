import { create } from '/lockbox/create'
import { open } from '/lockbox/open'
import { generateKeys } from '/keys'

describe('lockbox', () => {
  it('round trip', () => {
    const adminKeys = generateKeys()
    const bobKeys = generateKeys()

    // Alice creates a lockbox for Bob containing the admin keys
    const lockbox = create(adminKeys, bobKeys)

    // Bob opens the lockbox and gets the admin keys
    const keys = open(lockbox, bobKeys)
    expect(keys).toEqual(adminKeys)
  })
})
