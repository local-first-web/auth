import { createKeyset, redactKeys, type Store } from '@localfirst/crdx'
import { describe, expect, it } from 'vitest'
import * as devices from '../../device/index.js'
import { generateProof } from '../../invitation/index.js'
import * as lockbox from '../../lockbox/index.js'
import { KeyType } from '../../util/index.js'
import { setup } from '../../util/testing/index.js'
import * as select from '../selectors/index.js'
import { type TeamAction, type TeamContext, type TeamState } from '../types.js'

const { TEAM, USER } = KeyType

/**
 * A lockbox manifest is a claim by its author about a key they have not proved they hold — see
 * "The rule this is all an instance of" in `docs/internals.md`. These are the cases where something
 * outside `lockbox.open` was taking a manifest field as a fact about a member.
 */
describe('Team', () => {
  describe('a manifest that claims something about a member', () => {
    /**
     * `admitMember` is deliberately open to non-admins — `Team.admitMember` says so itself, because
     * a member knows the team keys and can hand them to someone they've let in. The admitting
     * member posts the invitee's FIRST team lockbox, and `keyMap` keeps the first keyset it sees
     * for a scope and generation. For an existing member that tie rule protects the keyset they
     * already have; for a brand-new member there is nothing older, so being first isn't a tiebreak
     * at all — it's a grant.
     *
     * Flipping the tie rule is not the fix; last-wins was measured worse. What the invitee needs is
     * an independent way to know which keyset the team actually issued, and an admission is exactly
     * the action that issues none.
     */
    const admitWith = (substituteKeys: boolean) => {
      const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])
      const realTeamKeys = alice.team.teamKeys()
      const { seed } = alice.team.inviteMember()
      bob.team.merge(alice.team.graph)

      const charlie = createKeyset({ type: USER, name: 'charlie-id' })
      const charlieDevice = devices.createDevice({
        userId: 'charlie-id',
        deviceName: 'laptop',
        seed: 'charlie-laptop',
      })
      const proof = generateProof(seed, charlie)
      const minted = createKeyset({ type: TEAM, name: TEAM })

      if (substituteKeys) {
        // 👨🏻‍🦲 Bob admits her, but puts a team keyset he minted in her lockbox instead of the team's
        const { store } = bob.team as unknown as {
          store: Store<TeamState, TeamAction, TeamContext>
        }
        store.dispatch(
          {
            type: 'ADMIT_MEMBER',
            payload: {
              id: proof.id,
              userName: 'charlie',
              memberKeys: redactKeys(charlie),
              proof,
              lockboxes: [lockbox.create(minted, redactKeys(charlie))],
            },
          } as TeamAction,
          bob.team.teamKeys()
        )
        bob.team.merge(bob.team.graph)
      } else {
        bob.team.admitMember(proof, redactKeys(charlie), 'charlie')
      }

      // She adds her device, and resolves the team keys the way her client will
      const { state } = bob.team
      const withHerDevice = {
        ...state,
        lockboxes: [...state.lockboxes, lockbox.create(charlie, redactKeys(charlieDevice.keys))],
      } as TeamState

      return {
        resolve: () => select.keys(withHerDevice, charlieDevice.keys, { type: TEAM, name: TEAM }),
        realTeamKeys,
        minted,
      }
    }

    it("doesn't let whoever admits you choose the team keys you'll use", () => {
      // Control: an honest non-admin admission hands her the team's own keys
      const honest = admitWith(false)
      expect(honest.resolve()).toEqual(honest.realTeamKeys)

      // ✅ ...and a substituted keyset is not something she'll use for the team. She has no team
      // keys at all, which is the truth: nobody ever gave her any.
      const substituted = admitWith(true)
      expect(substituted.resolve).toThrowError(/Couldn't find keys the team issued/)
    })
  })
})
