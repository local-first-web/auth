import * as keyset from '/keyset'
import { KeyType } from '/keyset'
import { create, open, rotate } from '/lockbox'
import { ADMIN } from '/role'
import { bob, eve, MANAGERS } from '/util/testing'

describe('lockbox', () => {
  it('can be opened by the intended recipient', () => {
    const adminKeys = keyset.create({ type: KeyType.ROLE, name: ADMIN })

    // Alice creates a lockbox for Bob containing the admin keys
    const lockbox = create(adminKeys, bob.keys)

    // Bob opens the lockbox and gets the admin keys
    const keys = open(lockbox, bob.keys)
    expect(keys).toEqual(adminKeys)
  })

  it(`can't be opened by anyone else`, () => {
    const adminKeys = keyset.create({ type: KeyType.ROLE, name: ADMIN })

    // Alice creates a lockbox for Bob containing the admin keys
    const lockbox = create(adminKeys, bob.keys)

    // Eve tries to open the lockbox but can't
    const eveTriesToOpen = () => open(lockbox, eve.keys)
    expect(eveTriesToOpen).toThrow()
  })

  it(`can only be rotated with a keyset of the same type`, () => {
    const adminKeys = keyset.create({ type: KeyType.ROLE, name: ADMIN })

    // Alice creates a lockbox for Bob containing the admin keys
    const lockbox = create(adminKeys, bob.keys)

    const newKeys = keyset.create({ type: KeyType.ROLE, name: MANAGERS })
    const tryToRotate = () => rotate(lockbox, newKeys)
    expect(tryToRotate).toThrow()
  })
})
