import { createKeyset, type Store } from '@localfirst/crdx'
import { describe, expect, it } from 'vitest'
import { redactDevice } from '../../device/index.js'
import * as lockbox from '../../lockbox/index.js'
import { KeyType } from '../../util/index.js'
import { setup, type UserStuff } from '../../util/testing/index.js'
import * as teams from '../index.js'
import { type TeamAction, type TeamContext, type TeamState } from '../types.js'

const { TEAM } = KeyType

const bobAuthorsDirectly = (bob: UserStuff, action: unknown) => {
  const { store } = bob.team as unknown as { store: Store<TeamState, TeamAction, TeamContext> }
  try { store.dispatch(action as TeamAction, bob.team.teamKeys()) } catch {}
}

const values: Array<[string, any]> = [
  ['2**31', 2 ** 31],
  ['2**32-1', 2 ** 32 - 1],
  ['MAX_SAFE_INTEGER-2', Number.MAX_SAFE_INTEGER - 2],
  ['MAX_SAFE_INTEGER-1 (2**53-2)', Number.MAX_SAFE_INTEGER - 1],
  ['MAX_SAFE_INTEGER (2**53-1)', Number.MAX_SAFE_INTEGER],
  ['-0', -0],
  ['NaN', Number.NaN],
  ['Infinity', Number.POSITIVE_INFINITY],
  ['string "3"', '3'],
  ['2**32 + 0.5', 2 ** 32 + 0.5],
]

describe('BOUNDARY (shipped shape: forged lockbox addressed to BOB)', () => {
  for (const [label, generation] of values) {
    it(`gen ${label}`, () => {
      const { alice, bob, charlie } = setup([
        'alice',
        { user: 'bob', admin: false },
        { user: 'charlie', admin: false },
      ])
      const charliesKeyring = charlie.team.teamKeyring()
      const forged = lockbox.create(
        { ...createKeyset({ type: TEAM, name: TEAM }), generation } as any,
        bob.user.keys
      )
      bobAuthorsDirectly(bob, {
        type: 'ADD_DEVICE',
        payload: { device: redactDevice(bob.phone!), lockboxes: [forged] },
      })
      let merged = true
      try { alice.team.merge(bob.team.graph) } catch { merged = false }
      let removeErr = ''
      try { alice.team.remove(charlie.userId) } catch (e) { removeErr = (e as Error).message.slice(0, 110) }
      let charlieCanRead = 'n/a'
      if (removeErr === '') {
        alice.team.addMessage({ secret: 'after you left' })
        try {
          teams.load(alice.team.save(), { user: charlie.user, device: charlie.device }, charliesKeyring).messages()
          charlieCanRead = 'YES — REMOVED MEMBER STILL READS'
        } catch { charlieCanRead = 'no' }
      }
      console.log(
        `${label}: merged=${merged} teamGen=${merged ? alice.team.teamKeys().generation : 'n/a'}` +
        ` remove=${removeErr === '' ? 'ok' : 'THREW: ' + removeErr} charlieReads=${charlieCanRead}`
      )
      expect(true).toBe(true)
    })
  }
})
