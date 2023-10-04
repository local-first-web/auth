import { ADMIN } from '@/role/index.js'
import { getScope } from '@/util/index.js'
import { setup } from '@/util/testing/index.js'
import { createKeyset, KeyType } from 'crdx'
import * as select from './index.js'

const { USER, DEVICE, TEAM, ROLE } = KeyType

describe('getVisibleKeys', () => {
  it('alice can see admin and team keys', () => {
    const { alice, bob } = setup('alice', { user: 'bob', admin: false })
    const keysAliceSees = select.getVisibleKeys(alice.team.state, alice.user.keys)
    expect(keysAliceSees.map(getScope)).toEqual([
      { type: TEAM, name: TEAM },
      { type: ROLE, name: ADMIN },
    ])
  })

  it('bob can only see team keys', () => {
    const { alice, bob } = setup('alice', { user: 'bob', admin: false })
    const keysBobKeys = select.getVisibleKeys(bob.team.state, bob.user.keys)
    expect(keysBobKeys.map(getScope)).toEqual([{ type: TEAM, name: TEAM }])
  })

  it('admin role can see team keys', () => {
    const { alice } = setup('alice')
    alice.team.addRole('MANAGERS')
    const adminKeys = alice.team.adminKeys()
    const keysAdminSees = select.getVisibleKeys(alice.team.state, adminKeys)
    expect(keysAdminSees.map(getScope)).toEqual([{ type: ROLE, name: 'MANAGERS' }])
  })

  it('admin role can see all other role keys', () => {
    const { alice } = setup('alice')
    alice.team.addRole('MANAGERS')
    const adminKeys = alice.team.adminKeys()
    const keysAdminSees = select.getVisibleKeys(alice.team.state, adminKeys)
    expect(keysAdminSees.map(getScope)).toEqual([{ type: ROLE, name: 'MANAGERS' }])
  })

  it('after rotating keys, can still see the same scopes', () => {
    const { alice } = setup('alice')
    const getDeviceKeys = () =>
      select.getVisibleKeys(alice.team.state, alice.device.keys).map(getScope)

    expect(getDeviceKeys()).toEqual([
      { type: USER, name: 'alice' },
      { type: TEAM, name: TEAM },
      { type: ROLE, name: ADMIN },
    ])

    // rotating the keys creates new lockboxes, but we don't see duplicate keys
    alice.team.changeKeys(createKeyset({ type: DEVICE, name: 'alice::laptop' }))
    expect(getDeviceKeys()).toEqual([
      { type: USER, name: 'alice' },
      { type: TEAM, name: TEAM },
      { type: ROLE, name: ADMIN },
    ])
  })
})
