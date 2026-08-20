import { createKeyset, redactKeys, type Store } from '@localfirst/crdx'
import { describe, expect, it } from 'vitest'
import * as devices from '../../device/index.js'
import { redactDevice } from '../../device/index.js'
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

    /**
     * `recipient.name` says who a lockbox is for; `recipient.publicKey` decides who can open it.
     * Nothing tied the two together, and both are fields a lockbox's author writes — so a lockbox
     * naming the victim while carrying somebody else's key joined the victim's group in
     * `lockboxesInScope`, and at a higher `contents.generation` it won that group. The rotation
     * then addressed the victim's replacement to the other key.
     */
    const rotateWith = (decoy: boolean) => {
      const { alice, bob, charlie, dwight } = setup([
        'alice',
        { user: 'bob', admin: false },
        { user: 'charlie', admin: false },
        { user: 'dwight', admin: false },
      ])

      if (decoy) {
        // Named for 👳🏽‍♂️ Charlie, carrying 👨🏻‍🦲 Bob's public key, claiming a later generation
        const real = alice.team.state.lockboxes.find(
          l => l.contents.type === TEAM && l.recipient.name === charlie.userId
        )!
        const forged = {
          ...lockbox.create(
            { ...createKeyset({ type: TEAM, name: TEAM }), generation: 5 },
            bob.user.keys
          ),
          recipient: { ...real.recipient, publicKey: redactKeys(bob.user.keys).encryption },
        }
        const { store } = bob.team as unknown as {
          store: Store<TeamState, TeamAction, TeamContext>
        }
        store.dispatch(
          {
            type: 'ADD_DEVICE',
            payload: { device: redactDevice(bob.phone!), lockboxes: [forged] },
          } as TeamAction,
          bob.team.teamKeys()
        )
        bob.team.merge(bob.team.graph)
        alice.team.merge(bob.team.graph)
      }

      // 👩🏾 Alice rotates the team keys by removing somebody unrelated
      alice.team.remove(dwight.userId)
      charlie.team.merge(alice.team.graph)
      return { alice, charlie }
    }

    it("doesn't let a name on a manifest take a member out of a rotation", () => {
      // Control: 👳🏽‍♂️ Charlie comes through the rotation holding the team's new keys
      const control = rotateWith(false)
      expect(control.charlie.team.teamKeys()).toEqual(control.alice.team.teamKeys())

      // ✅ ...and with the decoy on the graph, he still does — he stayed a member, so a rotation
      // has to reach him
      const attacked = rotateWith(true)
      expect(attacked.alice.team.has(attacked.charlie.userId)).toBe(true)
      expect(attacked.charlie.team.teamKeys()).toEqual(attacked.alice.team.teamKeys())
      expect(attacked.charlie.team.decrypt(attacked.alice.team.encrypt('hello'))).toBe('hello')
    })
  })
})
