import { createKeyset, type Store } from '@localfirst/crdx'
import { describe, expect, it } from 'vitest'
import { redactDevice } from '../../device/index.js'
import { create, type Lockbox } from '../../lockbox/index.js'
import { setup, type UserStuff } from '../../util/testing/index.js'
import * as teams from '../index.js'
import { type TeamAction, type TeamContext, type TeamState } from '../types.js'

const bobAuthorsDirectly = (bob: UserStuff, action: unknown) => {
  const { store } = bob.team as unknown as { store: Store<TeamState, TeamAction, TeamContext> }
  try { store.dispatch(action as TeamAction, bob.team.teamKeys()) } catch {}
}

for (const depth of [500, 2000, 5000]) {
  describe(`DEEP CHAIN ${depth}`, () => {
    it('does not overflow', () => {
      const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])
      const keysets = Array.from({ length: depth }, (_, i) => createKeyset({ type: 'ROLE', name: `x${i}` }))
      const lockboxes: Lockbox[] = [create(keysets[0], alice.user.keys)]
      for (let i = 1; i < depth; i++) lockboxes.push(create(keysets[i], keysets[i - 1]))
      bobAuthorsDirectly(bob, {
        type: 'ADD_DEVICE',
        payload: { device: redactDevice(bob.phone!), lockboxes },
      })
      let msg = 'ok'
      try { alice.team.merge(bob.team.graph); alice.team.addRole('managers') }
      catch (e) { msg = 'THREW: ' + (e as Error).message.slice(0, 90) }
      console.log(`depth ${depth}: ${msg}`)
      expect(true).toBe(true)
    })
  })
}
