import { KeyType } from '/keyset'
import * as keyset from '/keyset'
import { create } from '/lockbox/create'
import { open } from '/lockbox/open'
import { ADMIN } from '/role'
import { bob } from '/util/testing'

describe('lockbox', () => {
  it('round trip', () => {
    const adminKeys = keyset.create({ type: KeyType.ROLE, name: ADMIN })

    // Alice creates a lockbox for Bob containing the admin keys
    const lockbox = create(adminKeys, bob.keys)

    // Bob opens the lockbox and gets the admin keys
    const keys = open(lockbox, bob.keys)
    expect(keys).toEqual(adminKeys)
  })
})
