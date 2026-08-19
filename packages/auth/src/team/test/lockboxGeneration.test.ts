import { createKeyset, type Store } from '@localfirst/crdx'
import { describe, expect, it } from 'vitest'
import { redactDevice } from '../../device/index.js'
import * as lockbox from '../../lockbox/index.js'
import { type Lockbox } from '../../lockbox/index.js'
import { KeyType } from '../../util/index.js'
import { setup, type UserStuff } from '../../util/testing/index.js'
import * as teams from '../index.js'
import * as select from '../selectors/index.js'
import { type TeamAction, type TeamContext, type TeamState } from '../types.js'

const { TEAM, ROLE, USER, EPHEMERAL } = KeyType

/**
 * A lockbox's `contents.generation` is a plain number on a plaintext manifest, so a forged one that
 * is shape-identical to an honest one can't be told apart at the door. What decides whether it
 * matters is who ends up holding new keys after a rotation — which is what these pin.
 *
 * The value 3 is not the interesting one; it's the one that was measured first. What a removal has
 * to survive is every value that can reach the field, so the range is the test.
 */

/** 👨🏻‍🦲 Bob authors a link his own pre-check would have refused, by going around it */
const bobAuthorsDirectly = (bob: UserStuff, action: unknown) => {
  const { store } = bob.team as unknown as {
    store: Store<TeamState, TeamAction, TeamContext>
  }
  try {
    store.dispatch(action as TeamAction, bob.team.teamKeys())
  } catch {
    // The validators refuse it, but it's on his graph either way — that's the point
  }
}

/** 👨🏻‍🦲 Bob mints team keys of his own, calls them generation 3, addresses them to himself, and
 * hangs them off an ADD_DEVICE — an action any member is allowed to post */
const forgeALockboxClaimingGeneration3 = (bob: UserStuff) => {
  const forged = lockbox.create(
    { ...createKeyset({ type: TEAM, name: TEAM }), generation: 3 },
    bob.user.keys
  )
  bobAuthorsDirectly(bob, {
    type: 'ADD_DEVICE',
    payload: { device: redactDevice(bob.phone!), lockboxes: [forged] },
  })
  return forged
}

describe('Team', () => {
  describe('a lockbox claiming a generation the team never issued', () => {
    it("doesn't stop a removal from rotating the team keys", () => {
      const { alice, bob, charlie } = setup([
        'alice',
        { user: 'bob', admin: false },
        { user: 'charlie', admin: false },
      ])

      forgeALockboxClaimingGeneration3(bob)
      alice.team.merge(bob.team.graph)
      expect(alice.team.teamKeys().generation).toBe(0)

      // ✅ Removing 👳🏽‍♂️ Charlie still moves the team keys on
      alice.team.remove(charlie.userId)
      expect(alice.team.teamKeys().generation).toBeGreaterThan(0)

      // ✅ ...and he can't read what 👩🏾 Alice posts afterwards, holding the keyring he had before
      // she removed him
      alice.team.addMessage({ secret: 'after you left' })
      const charlieReads = () =>
        teams
          .load(
            alice.team.save(),
            { user: charlie.user, device: charlie.device },
            charlie.team.teamKeyring()
          )
          .messages()
      expect(charlieReads).toThrowError(/don't have the correct keyset/)
    })

    /**
     * Every value that can reach `contents.generation`, not the one that was measured first.
     *
     * Each of these defeated removal outright before: `teamKeys().generation` stayed at 0 and the
     * removed member read a message posted after they left. `0.5` and `2**40` did it without any
     * arithmetic error, because the rotated keyset was filed under something that isn't an array
     * index, so the history never grew and the latest generation resolved back to 0.
     *
     * Two outcomes are acceptable and both are allowed for below: the door refuses the link, or the
     * rotation works. What isn't acceptable is the third one, which is what each of these did.
     */
    const everyGeneration = [
      ['a whole number', 3],
      ['a fraction', 0.5],
      ['a negative number', -1],
      ['the largest array index', 2 ** 32 - 1],
      ['one past the largest array index', 2 ** 32],
      ['a large safe integer', 2 ** 40],
      ['a number too large to be an integer', 1e21],
      ['the largest safe integer', Number.MAX_SAFE_INTEGER],
    ] as const

    for (const [description, generation] of everyGeneration) {
      it(`never lets a removed member read what's posted after them: ${description}`, () => {
        const { alice, bob, charlie } = setup([
          'alice',
          { user: 'bob', admin: false },
          { user: 'charlie', admin: false },
        ])
        const charliesKeyring = charlie.team.teamKeyring()

        const forged = lockbox.create(
          { ...createKeyset({ type: TEAM, name: TEAM }), generation },
          bob.user.keys
        )
        bobAuthorsDirectly(bob, {
          type: 'ADD_DEVICE',
          payload: { device: redactDevice(bob.phone!), lockboxes: [forged] },
        })

        // Either 👩🏾 Alice refuses his graph outright...
        let merged = true
        try {
          alice.team.merge(bob.team.graph)
        } catch {
          merged = false
        }

        // ...or she takes it, and removal still moves the team keys past whatever it claimed
        alice.team.remove(charlie.userId)
        expect(alice.team.teamKeys().generation).toBeGreaterThan(merged ? generation : 0)

        // ✅ Either way 👳🏽‍♂️ Charlie is locked out of what she posts next
        alice.team.addMessage({ secret: 'after you left' })
        const charlieReads = () =>
          teams
            .load(
              alice.team.save(),
              { user: charlie.user, device: charlie.device },
              charliesKeyring
            )
            .messages()
        expect(charlieReads).toThrowError(/don't have the correct keyset/)
      })
    }

    it("doesn't take the rotated keys away from everyone else", () => {
      const { alice, bob, charlie } = setup([
        'alice',
        { user: 'bob', admin: false },
        { user: 'charlie', admin: false },
      ])

      forgeALockboxClaimingGeneration3(bob)
      alice.team.merge(bob.team.graph)
      alice.team.remove(charlie.userId)

      // ✅ Everyone still on the team holds the new keys, under the same generation 👩🏾 Alice used
      bob.team.merge(alice.team.graph)
      expect(bob.team.teamKeys()).toEqual(alice.team.teamKeys())

      // ✅ ...so a message she encrypts is one he can read
      const message = alice.team.encrypt('hello')
      expect(bob.team.decrypt(message)).toBe('hello')
    })

    it("isn't the only lockbox rotation can see", () => {
      const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])

      // The same forgery, put straight into state
      const forged = lockbox.create(
        { ...createKeyset({ type: TEAM, name: TEAM }), generation: 3 },
        bob.user.keys
      )
      const state = {
        ...alice.team.state,
        lockboxes: [...alice.team.state.lockboxes, forged],
      }

      // ✅ The selector that decides who gets replacement keys still names every honest recipient,
      // rather than the one lockbox that claims to be ahead of them
      const inScope = select.lockboxesInScope(state, { type: TEAM, name: TEAM })
      expect(inScope.map(l => l.recipient.name).sort()).toEqual(
        alice.team.state.lockboxes
          .filter(l => l.contents.type === TEAM)
          .map(l => l.recipient.name)
          .sort()
      )
    })
  })

  describe('honest lockbox generations', () => {
    it('rotate one generation at a time, over and over', () => {
      const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])

      // Each removal rotates the team keys exactly once
      alice.team.addRole('managers')
      expect(alice.team.roleKeys('managers').generation).toBe(0)

      alice.team.addMemberRole(bob.userId, 'managers')
      alice.team.removeMemberRole(bob.userId, 'managers')
      expect(alice.team.roleKeys('managers').generation).toBe(1)

      alice.team.addMemberRole(bob.userId, 'managers')
      alice.team.removeMemberRole(bob.userId, 'managers')
      expect(alice.team.roleKeys('managers').generation).toBe(2)

      // ✅ And every generation along the way is still reachable
      expect(
        select.keys(alice.team.state, alice.device.keys, { type: ROLE, name: 'managers' })
          .generation
      ).toBe(2)
    })

    it('give each outstanding invitation its own replacement', () => {
      const { alice } = setup('alice')

      // Every keyset minted from an invitation seed is named EPHEMERAL, so two invitations are two
      // holders under one name
      alice.team.inviteDevice()
      alice.team.inviteDevice()

      const ephemeralRecipients = (lockboxes: Lockbox[]) =>
        new Set(
          lockboxes.filter(l => l.recipient.type === EPHEMERAL).map(l => l.recipient.publicKey)
        )

      const inScope = select.lockboxesInScope(alice.team.state, {
        type: USER,
        name: alice.userId,
      })

      // ✅ Both of them are still in the answer
      expect(ephemeralRecipients(inScope).size).toBe(2)
    })

    it('let a member who joins later pick up every generation of the team keys', () => {
      const { alice, bob, charlie } = setup([
        'alice',
        { user: 'bob', admin: false },
        { user: 'charlie', admin: false },
      ])

      // 👳🏽‍♂️ Charlie's removal rotates the team keys, so 👨🏻‍🦲 Bob now holds two generations
      alice.team.remove(charlie.userId)
      bob.team.merge(alice.team.graph)
      expect(Object.keys(bob.team.teamKeyring())).toHaveLength(2)
      expect(bob.team.teamKeys().generation).toBe(1)
    })
  })
})
