import { createKeyset, redactKeys, type Store } from '@localfirst/crdx'
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
     * Most of these defeated removal outright before: `teamKeys().generation` stayed at 0 and the
     * removed member read a message posted after they left. `0.5` and `2**40` did it without any
     * arithmetic error, because the rotated keyset was filed under something that isn't an array
     * index, so the history never grew and the latest generation resolved back to 0.
     *
     * `-1` is the exception and is here as a boundary rather than as an exploit: it never defeated
     * removal, because `Math.max` and `lockboxesInScope` both step over a generation below the
     * honest one. Disabling any of the checks below leaves this row passing. It's in the table so
     * that the range is the range, not so that it pins anything.
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
      // The value that used to make the REMOVER's own link unrepresentable: it passes the payload
      // check because its own successor is a safe integer, and the rotation that has to supersede
      // it needs one more than that
      ['one below the largest safe integer', Number.MAX_SAFE_INTEGER - 1],
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

        // ...or she takes it — and either way the number the forgery named doesn't decide anything.
        // A rotation counts the keysets the graph has carried for the scope, so the forged keyset
        // costs it one slot and nothing more: two if her graph took the link, one if it didn't.
        // Counting from the largest number a manifest named is what let a value at the top of the
        // range make her own removal link unrepresentable, permanently.
        alice.team.remove(charlie.userId)
        expect(alice.team.teamKeys().generation).toBe(merged ? 2 : 1)

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

    it("doesn't take the rotated keys away from the members who didn't write it", () => {
      const { alice, bob, charlie, dwight } = setup([
        'alice',
        { user: 'bob', admin: false },
        { user: 'charlie', admin: false },
        { user: 'dwight', admin: false },
      ])

      forgeALockboxClaimingGeneration3(bob)
      alice.team.merge(bob.team.graph)
      alice.team.remove(charlie.userId)

      // ✅ 🧔🏾‍♂️ Dwight, who had nothing to do with it, holds the new keys under the same generation
      // 👩🏾 Alice used, so a message she encrypts is one he can read
      dwight.team.merge(alice.team.graph)
      expect(dwight.team.teamKeys()).toEqual(alice.team.teamKeys())
      expect(dwight.team.decrypt(alice.team.encrypt('hello'))).toBe('hello')
    })

    it('stops being current for anyone as soon as the scope is rotated', () => {
      const { alice, bob, charlie } = setup([
        'alice',
        { user: 'bob', admin: false },
        { user: 'charlie', admin: false },
      ])

      forgeALockboxClaimingGeneration3(bob)
      alice.team.merge(bob.team.graph)
      bob.team.merge(alice.team.graph)

      // Until somebody rotates, a keyset a member added is the newest one the graph carries for
      // that scope, so it's current for whoever can open it. That's auth-9sl, still open.
      expect(bob.team.teamKeys().generation).toBe(3)

      // 👩🏾 Alice removes 👳🏽‍♂️ Charlie, which rotates the team keys
      alice.team.remove(charlie.userId)
      bob.team.merge(alice.team.graph)

      // ✅ The rotation is the newest thing on the graph, so it's current for both of them — the
      // number the forgery claimed doesn't keep it in front. Deciding this by the highest
      // generation held instead left the forgery current forever, and made "rotate the scope" — the
      // documented remediation — do nothing at all.
      expect(bob.team.teamKeys()).toEqual(alice.team.teamKeys())
      expect(bob.team.teamKeys().generation).not.toBe(3)
      expect(bob.team.decrypt(alice.team.encrypt('hello'))).toBe('hello')
    })
  })

  describe('rotating a scope that has been forged over', () => {
    /**
     * The remediation `docs/internals.md` gives has to work whatever number the forgery claimed.
     * While "current" was the highest generation the device held, it worked for a forgery at
     * generation 0 and did nothing for one at generation 9: a rotation numbers its replacement from
     * `keyHistory.length`, which is small, so the honest keyset came out below the forgery and never
     * became current. Rotating twice more didn't help either.
     */
    for (const generation of [0, 9, 2 ** 32]) {
      it(`takes a role back from a forgery claiming generation ${generation}`, () => {
        const { alice, bob, charlie } = setup([
          'alice',
          { user: 'bob', admin: false },
          { user: 'charlie', admin: false },
        ])
        alice.team.addRole('managers')

        const forged = { ...createKeyset({ type: ROLE, name: 'managers' }), generation }
        bobAuthorsDirectly(bob, {
          type: 'ADD_DEVICE',
          payload: {
            device: redactDevice(bob.phone!),
            lockboxes: [lockbox.create(forged, alice.user.keys)],
          },
        })
        alice.team.merge(bob.team.graph)

        // The documented remediation: rotate the role
        alice.team.addMemberRole(charlie.userId, 'managers')
        alice.team.removeMemberRole(charlie.userId, 'managers')

        // ✅ The role's keys are the team's again
        expect(alice.team.roleKeys('managers').secretKey).not.toBe(forged.secretKey)
      })
    }

    it('takes the team keys back, for everyone, when the forger is removed', () => {
      const { alice, bob, charlie, dwight } = setup([
        'alice',
        'charlie',
        { user: 'bob', admin: false },
        { user: 'dwight', admin: false },
      ])

      // One link, addressed to each member's USER keys — `Team.ts:106`'s own pairing, so nothing at
      // the door can refuse it — replaces the team keys for everyone, both admins included
      const forged = { ...createKeyset({ type: TEAM, name: TEAM }), generation: 9 }
      bobAuthorsDirectly(bob, {
        type: 'ADD_DEVICE',
        payload: {
          device: redactDevice(bob.phone!),
          lockboxes: [alice, charlie, dwight].map(victim =>
            lockbox.create(forged, victim.user.keys)
          ),
        },
      })
      for (const victim of [alice, charlie, dwight]) victim.team.merge(bob.team.graph)
      expect(alice.team.teamKeys().secretKey).toBe(forged.secretKey)

      // ✅ Removing the forger rotates the team keys, and the rotation is the newest thing on the
      // graph — so everyone still on the team comes back to keys he doesn't have
      alice.team.remove(bob.userId)
      expect(alice.team.teamKeys().secretKey).not.toBe(forged.secretKey)
      for (const victim of [charlie, dwight]) {
        victim.team.merge(alice.team.graph)
        expect(victim.team.teamKeys()).toEqual(alice.team.teamKeys())
      }
    })

    /**
     * `updateUserKeys` picks up new keys for ourselves after a rotation. It used to take the highest
     * `generation` among the keysets in our keyring — a number off a lockbox — so a member could
     * hand us a keyset of theirs called generation 9 and we would adopt it as our own, and no later
     * rotation could get us back, because the honest replacement is numbered below it.
     *
     * Taking the keyset the GRAPH makes current does not stop us adopting it — a keyset a member
     * appends really is the newest one the graph carries for that scope, which is auth-9sl and is
     * still open. What it fixes is that re-keying now gets us out.
     */
    it("doesn't adopt a keyset the team never registered as ours", () => {
      const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])

      // USER keys to a DEVICE is the one pairing addressed to a device that the door has to allow
      const forged = { ...createKeyset({ type: USER, name: alice.userId }), generation: 9 }
      bobAuthorsDirectly(bob, {
        type: 'ADD_DEVICE',
        payload: {
          device: redactDevice(bob.phone!),
          lockboxes: [lockbox.create(forged, redactKeys(alice.device.keys))],
        },
      })
      const realKeys = alice.user.keys.encryption.publicKey
      alice.team.merge(bob.team.graph)

      // ✅ She doesn't adopt it: the team never registered it as hers, and a lockbox naming her
      // scope is something anybody can post
      expect(alice.user.keys.encryption.publicKey).toBe(realKeys)

      // ✅ ...and she can still act, which she couldn't if she'd taken up a key no peer recognises
      expect(() => alice.team.addRole('managers')).not.toThrow()
    })

    /**
     * The remediation for a member whose keys are compromised is that an admin re-keys them, and
     * they pick the new keyset up on their next merge. That pick-up compared `generation` fields, so
     * a member sitting on a forgery called generation 9 never took the admin's replacement — its
     * generation comes from `keyHistory.length` and is small. The one remediation aimed at exactly
     * this situation did nothing, permanently, and neither of them would see an error.
     */
    it('lets an admin re-key a member who is sitting on a forged keyset', () => {
      const { alice, bob, charlie } = setup([
        'alice',
        { user: 'bob', admin: false },
        { user: 'charlie', admin: false },
      ])

      const forged = { ...createKeyset({ type: USER, name: bob.userId }), generation: 9 }
      bobAuthorsDirectly(charlie, {
        type: 'ADD_DEVICE',
        payload: {
          device: redactDevice(charlie.phone!),
          lockboxes: [lockbox.create(forged, redactKeys(bob.device.keys))],
        },
      })
      bob.team.merge(charlie.team.graph)
      expect(bob.user.keys.encryption.publicKey).not.toBe(forged.encryption.publicKey)

      // 👩🏾 Alice, an admin, re-keys 👨🏻‍🦲 Bob
      alice.team.merge(charlie.team.graph)
      const replacement = createKeyset({ type: USER, name: bob.userId })
      alice.team.changeKeys(replacement)

      // ✅ 👨🏻‍🦲 Bob picks up the keys she made for him — the team registered those, so he takes
      // them, and they're what he signs with from here
      bob.team.merge(alice.team.graph)
      expect(bob.user.keys.encryption.publicKey).toBe(replacement.encryption.publicKey)
      expect(() => bob.team.addMessage).not.toThrow()
    })
  })

  describe('a lockbox naming a generation at the top of the range', () => {
    /**
     * A rotation has to produce a generation that supersedes what it replaces. While that number
     * came from the largest one any manifest claimed, there was no ceiling that helped: whatever
     * value a payload check accepts as the largest, a member can name it, and the rotation that has
     * to beat it needs one past the largest acceptable value — so the REMOVER's own link is refused
     * by the remover's own check, for good.
     *
     * Both routes below reached that. Neither is a shape any rule could refuse: one is
     * `Team.ts:106`'s own pairing, and the other is a lockbox nobody but its author can ever open.
     */
    const nearlyTheLargest = Number.MAX_SAFE_INTEGER - 1

    it("doesn't stop removals when it's addressed to an admin's own keys", () => {
      const { alice, bob, charlie } = setup([
        'alice',
        { user: 'bob', admin: false },
        { user: 'charlie', admin: false },
      ])

      // TEAM keys to a member's USER keys is what `create` and `admitMember` both post
      bobAuthorsDirectly(bob, {
        type: 'ADD_DEVICE',
        payload: {
          device: redactDevice(bob.phone!),
          lockboxes: [
            lockbox.create(
              { ...createKeyset({ type: TEAM, name: TEAM }), generation: nearlyTheLargest },
              alice.user.keys
            ),
          ],
        },
      })
      alice.team.merge(bob.team.graph)

      // ✅ 👩🏾 Alice can still remove people — both of them, one after the other
      expect(() => alice.team.remove(charlie.userId)).not.toThrow()
      expect(() => alice.team.remove(bob.userId)).not.toThrow()
    })

    it("doesn't stop removals when nobody but its author can open it", () => {
      const { alice, bob, charlie } = setup([
        'alice',
        { user: 'bob', admin: false },
        { user: 'charlie', admin: false },
      ])

      // Addressed to himself, naming 👳🏽‍♂️ Charlie's scope — the one a remover can never open, so
      // there is nothing to count from but the manifest
      bobAuthorsDirectly(bob, {
        type: 'ADD_DEVICE',
        payload: {
          device: redactDevice(bob.phone!),
          lockboxes: [
            lockbox.create(
              {
                ...createKeyset({ type: USER, name: charlie.userId }),
                generation: nearlyTheLargest,
              },
              bob.user.keys
            ),
          ],
        },
      })
      alice.team.merge(bob.team.graph)

      // ✅ 👳🏽‍♂️ Charlie can still be removed, and so can 👨🏻‍🦲 Bob
      expect(() => alice.team.remove(charlie.userId)).not.toThrow()
      expect(() => alice.team.remove(bob.userId)).not.toThrow()
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
