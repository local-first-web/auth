import { ADMIN } from '@/role'
import { KeyType } from '@/util'
import { setup } from '@/util/testing'
import { createKeyset } from '@localfirst/crdx'
import { describe, expect, it } from 'vitest'
import * as select from '.'

const { USER, DEVICE, TEAM, ROLE } = KeyType

describe('getVisibleScopes', () => {
  it(`alice's device can see user, admin and team keys`, () => {
    const { alice } = setup('alice')
    const deviceScopes = select.getVisibleScopes(alice.team.state, {
      type: DEVICE,
      name: 'alice::laptop',
    })
    expect(deviceScopes).toEqual([
      { type: USER, name: 'alice' },
      { type: TEAM, name: TEAM },
      { type: ROLE, name: ADMIN },
    ])
  })

  it('alice can see admin and team keys', () => {
    const { alice } = setup('alice')
    const aliceScopes = select.getVisibleScopes(alice.team.state, { type: USER, name: 'alice' })
    expect(aliceScopes).toEqual([
      { type: TEAM, name: TEAM },
      { type: ROLE, name: ADMIN },
    ])
  })

  it('bob can only see team keys', () => {
    const { bob } = setup('alice', { user: 'bob', admin: false })
    const bobScopes = select.getVisibleScopes(bob.team.state, { type: USER, name: 'bob' })
    expect(bobScopes).toEqual([{ type: TEAM, name: TEAM }])
  })

  it('admin role can see all other role keys', () => {
    const { alice } = setup('alice')
    alice.team.addRole('MANAGERS')
    const adminScopes = select.getVisibleScopes(alice.team.state, { type: ROLE, name: ADMIN })
    expect(adminScopes).toEqual([{ type: ROLE, name: 'MANAGERS' }])
  })

  it('after rotating keys, can still see the same scopes', () => {
    const { alice } = setup('alice')
    const getDeviceScopes = () =>
      select.getVisibleScopes(alice.team.state, {
        type: DEVICE,
        name: 'alice::laptop',
      })

    const changeDeviceKeys = () =>
      alice.team.changeKeys(createKeyset({ type: DEVICE, name: 'alice::laptop' }))

    expect(getDeviceScopes()).toEqual([
      { type: USER, name: 'alice' },
      { type: TEAM, name: TEAM },
      { type: ROLE, name: ADMIN },
    ])

    // rotating the keys creates new lockboxes, but we don't see duplicate scopes
    changeDeviceKeys()
    expect(getDeviceScopes().length).toBe(3)

    changeDeviceKeys()
    expect(getDeviceScopes().length).toBe(3)
  })
})
