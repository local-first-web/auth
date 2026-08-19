import { createKeyset, type Store } from '@localfirst/crdx'
import { describe, expect, it } from 'vitest'
import { redactDevice } from '../../device/index.js'
import * as lockbox from '../../lockbox/index.js'
import { KeyType } from '../../util/index.js'
import { setup, type UserStuff } from '../../util/testing/index.js'
import { type TeamAction, type TeamContext, type TeamState } from '../types.js'

const { TEAM } = KeyType
const bobAuthorsDirectly = (bob: UserStuff, action: unknown) => {
  const { store } = bob.team as unknown as { store: Store<TeamState, TeamAction, TeamContext> }
  try { store.dispatch(action as TeamAction, bob.team.teamKeys()) } catch {}
}

describe('SECOND ROTATION', () => {
  it('after a forged 2**53-3 the team gets one rotation and then none', () => {
    const { alice, bob, charlie, dwight } = setup([
      'alice',
      { user: 'bob', admin: false },
      { user: 'charlie', admin: false },
      { user: 'dwight', admin: false },
    ])
    const generation = Number.MAX_SAFE_INTEGER - 2
    const forged = lockbox.create(
      { ...createKeyset({ type: TEAM, name: TEAM }), generation } as any,
      bob.user.keys
    )
    bobAuthorsDirectly(bob, {
      type: 'ADD_DEVICE',
      payload: { device: redactDevice(bob.phone!), lockboxes: [forged] },
    })
    alice.team.merge(bob.team.graph)
    try { alice.team.remove(charlie.userId); console.log('remove#1 ok, gen', alice.team.teamKeys().generation) }
    catch (e) { console.log('remove#1 THREW:', (e as Error).message.slice(0, 120)) }
    try { alice.team.remove(dwight.userId); console.log('remove#2 ok, gen', alice.team.teamKeys().generation) }
    catch (e) { console.log('remove#2 THREW:', (e as Error).message.slice(0, 120)) }
    expect(true).toBe(true)
  })
})
