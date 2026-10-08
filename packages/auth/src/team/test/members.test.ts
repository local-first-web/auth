import { createUser, redactKeys } from '@localfirst/crdx'
import { createDevice, loadTeam, redactDevice } from '../../index.js'
import { generateProof } from '../../invitation/index.js'
import { ADMIN } from '../../role/index.js'
import { invalidLinkReducer } from '../invalidLinkReducer.js'
import { type TeamLink } from '../types.js'
import { validate } from '../validate.js'
import { setup } from '../../util/testing/index.js'
import '../../util/testing/expect/toLookLikeKeyset.js'
import { describe, expect, it } from 'vitest'

describe('Team', () => {
  describe('members', () => {
    it('has Alice as a root member', () => {
      const { alice } = setup('alice')
      expect(alice.team.members().length).toBe(1)
      const A = alice.team.members(alice.userId)
      expect(A.userName).toBe('alice')
    })

    it('has lockboxes for Alice containing the admin and team secrets', () => {
      const { alice } = setup('alice')
      const adminKeyset = alice.team.roleKeys(ADMIN)
      expect(adminKeyset).toLookLikeKeyset()

      const teamKeys = alice.team.teamKeys()
      expect(teamKeys).toLookLikeKeyset()
    })

    it('adds a member', () => {
      const { alice, bob } = setup('alice', 'bob')
      expect(alice.team.members().length).toBe(2)

      // look bob up by userId
      const bob2 = alice.team.members(bob.userId)
      expect(bob2.userName).toBe('bob')
    })

    it('makes lockboxes for added members', () => {
      // Alice creates a team, adds Bob
      const { bob } = setup('alice', { user: 'bob', admin: false })

      // Bob has team keys
      const teamKeys = bob.team.teamKeys()
      expect(teamKeys).toLookLikeKeyset()

      // Bob is not an admin so he doesn't have admin keys
      const bobLooksForAdminKeys = () => bob.team.roleKeys(ADMIN)
      expect(bobLooksForAdminKeys).toThrow()
    })

    it('makes an admin lockbox for an added admin member', () => {
      // Alice creates a team, adds Bob as an admin
      const { bob } = setup('alice', { user: 'bob', admin: true })

      // Bob is an admin and has admin keys
      const adminKeyset = bob.team.roleKeys(ADMIN)
      expect(adminKeyset).toLookLikeKeyset()
    })

    it("doesn't care if you add a member twice", () => {
      const { alice, bob } = setup('alice', { user: 'bob', member: false })

      const addBob = () => {
        alice.team.addForTesting(bob.user)
      }

      expect(addBob).not.toThrow()

      // Try adding bob again
      const addBobAgain = () => {
        alice.team.addForTesting(bob.user)
      }

      expect(addBobAgain).not.toThrow()
    })

    it('removes a member', () => {
      const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

      expect(alice.team.has(bob.userId)).toBe(true)
      expect(alice.team.memberWasRemoved(bob.userId)).toBe(false)

      alice.team.remove(bob.userId)
      expect(alice.team.has(bob.userId)).toBe(false)

      // memberWasRemoved works as expected
      expect(alice.team.memberWasRemoved(alice.userId)).toBe(false) // Alice is still a member
      expect(alice.team.memberWasRemoved(bob.userId)).toBe(true) // Bob is no longer a member
      expect(alice.team.memberWasRemoved(charlie.userId)).toBe(false) // Charlie was never a member
    })

    it('clears the tombstone for a re-added member, and only that member', () => {
      const { alice, bob, charlie } = setup('alice', 'bob', 'charlie')

      alice.team.remove(bob.userId)
      alice.team.remove(charlie.userId)
      expect(alice.team.memberWasRemoved(bob.userId)).toBe(true)
      expect(alice.team.memberWasRemoved(charlie.userId)).toBe(true)

      // Bob is re-added
      alice.team.addForTesting(bob.user)

      // Bob's tombstone is cleared, because he's a member again
      expect(alice.team.memberWasRemoved(bob.userId)).toBe(false)

      // Charlie's tombstone is untouched — re-adding Bob says nothing about Charlie
      expect(alice.team.memberWasRemoved(charlie.userId)).toBe(true)
    })

    it('only admins can remove members', () => {
      const { alice, bob, charlie } = setup('alice', { user: 'bob', admin: false }, 'charlie')

      // Bob can't remove Charlie because Bob's not an admin
      expect(() => bob.team.remove(charlie.userId)).toThrow()

      // Alice can remove Charlie because Alice is an admin
      expect(() => alice.team.remove(charlie.userId)).not.toThrow()
    })

    it('rotates keys after removing a member', () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: true })

      // Keys have never been rotated
      expect(alice.team.teamKeys().generation).toBe(0)
      expect(alice.team.adminKeys().generation).toBe(0)

      // Remove bob from team
      alice.team.remove(bob.userId)

      // Team keys & admin keys have now been rotated once
      expect(alice.team.teamKeys().generation).toBe(1)
      expect(alice.team.adminKeys().generation).toBe(1)
    })

    it("can't admit a member once they've been removed", () => {
      const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

      // 👩🏾 Alice invites 👳🏽‍♂️ Charlie, so there's a live invitation on the graph
      const { seed } = alice.team.inviteMember()

      // 👩🏾 Alice removes 👨🏻‍🦲 Bob
      alice.team.remove(bob.userId)

      // In practice an ex-member can't read past their own removal, because removing them rotates
      // the team keys — so anything they author is concurrent with the removal, which is the
      // resolver's business (`cantDoAnythingWhenRemoved`). Here we hand 👨🏻‍🦲 Bob the post-removal
      // graph and keyring, so that the admission is unambiguously downstream of the removal and
      // it's the validator that has to say no.
      const exMemberTeam = loadTeam(alice.team.save(), bob.localContext, alice.team.teamKeyring())
      expect(exMemberTeam.memberWasRemoved(bob.userId)).toBe(true)

      // ❌ 👨🏻‍🦲 Bob knows about the invitation, but admitting is no longer his to do. His keys
      // stay registered so that what he authored while on the team remains valid, and admitting
      // isn't admin-only — so nothing else here stops him.
      const tryToAdmitCharlie = () => {
        exMemberTeam.admitMember(
          generateProof(seed, charlie.user.keys),
          charlie.user.keys,
          charlie.userName
        )
      }

      expect(tryToAdmitCharlie).toThrow(/was removed from the team/i)
      expect(exMemberTeam.has(charlie.userId)).toBe(false)

      // ✅ 👩🏾 Alice is still on the team, so the same invitation still admits 👳🏽‍♂️ Charlie
      alice.team.admitMember(
        generateProof(seed, charlie.user.keys),
        charlie.user.keys,
        charlie.userName
      )
      expect(alice.team.has(charlie.userId)).toBe(true)
    })

    it("can't admit a device once they've been removed", () => {
      const { alice, bob } = setup('alice', 'bob')
      const bobsPhone = redactDevice(bob.phone!)

      // 👨🏻‍🦲 Bob invites two devices of his own
      const { seed: firstSeed } = bob.team.inviteDevice()
      const { seed: secondSeed } = bob.team.inviteDevice()

      // ✅ While he's on the team, his own invitation admits 📱 his phone
      bob.team.admitDevice(generateProof(firstSeed, bobsPhone.keys), bobsPhone)
      expect(bob.team.members(bob.userId).devices).toHaveLength(2)

      // 👩🏾 Alice syncs up and removes him
      alice.team.merge(bob.team.graph)
      alice.team.remove(bob.userId)

      const exMemberTeam = loadTeam(alice.team.save(), bob.localContext, alice.team.teamKeyring())
      expect(exMemberTeam.memberWasRemoved(bob.userId)).toBe(true)

      // ❌ His second invitation is still open, but he can't spend it either
      const bobsOtherDevice = redactDevice(
        createDevice({ userId: bob.userId, deviceName: 'bobs other device' })
      )
      const tryToAdmitAnotherDevice = () => {
        exMemberTeam.admitDevice(generateProof(secondSeed, bobsOtherDevice.keys), bobsOtherDevice)
      }

      expect(tryToAdmitAnotherDevice).toThrow(/was removed from the team/i)
      expect(exMemberTeam.hasDevice(bobsOtherDevice.deviceId)).toBe(false)
    })

    it("can't author anything once their admission has been invalidated", () => {
      const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

      // 👨🏻‍🦲 Bob is an admin, so he invites 👳🏽‍♂️ Charlie and admits him
      const { seed } = bob.team.inviteMember()
      bob.team.admitMember(
        generateProof(seed, charlie.user.keys),
        charlie.user.keys,
        charlie.userName
      )
      expect(bob.team.has(charlie.userId)).toBe(true)

      // ...but 👩🏾 Alice removed him concurrently, so when the two graphs meet, everything that
      // followed from his invitation is discarded. `invalidLinkReducer` treats the invalidated
      // admission as a removal, which is the one way someone lands in `removedMembers` without
      // ever having been in `members`.
      alice.team.remove(bob.userId)
      alice.team.merge(bob.team.graph)
      expect(alice.team.has(charlie.userId)).toBe(false)
      expect(alice.team.memberWasRemoved(charlie.userId)).toBe(true)

      // 👳🏽‍♂️ Charlie was given keys while Bob's side still thought he was a member, and his own
      // keys stay registered, so nothing about authorship stops him. We hand him the merged graph
      // and the current team keys, so that what he authors is unambiguously downstream of the
      // invalidation and it's the validator that has to say no.
      const charliesTeam = loadTeam(
        alice.team.save(),
        charlie.localContext,
        alice.team.teamKeyring()
      )
      const addADevice = () => {
        charliesTeam.dispatch(
          { type: 'ADD_DEVICE', payload: { device: redactDevice(charlie.phone!) } },
          alice.team.teamKeys()
        )
      }

      expect(addADevice).toThrow(/was removed from the team/i)
      expect(charliesTeam.hasDevice(charlie.phone!.deviceId)).toBe(false)
    })

    it('can still act when a discarded admission has named them in removedMembers', () => {
      const { alice, charlie } = setup('alice', 'bob', 'charlie')

      // 👳🏽‍♂️ Charlie adds a device of his own, the ordinary way
      charlie.team.dispatch({
        type: 'ADD_DEVICE',
        payload: { device: redactDevice(charlie.phone!) },
      })
      const [head] = charlie.team.graph.head
      const charliesLink = charlie.team.graph.links[head]
      expect(validate(alice.team.state, charliesLink).isValid).toBe(true)

      // Now the state an invalidated admission leaves behind. `invalidLinkReducer` appends the
      // admitted member to `removedMembers` and says so explicitly: it doesn't touch `members`,
      // because the member it's discarding was never added. That's the one way to be named in both
      // lists at once — and it's what the rule's early return is for.
      //
      // This goes through that reducer rather than staging a merge race, because which of two
      // concurrent admissions lands last is decided by comparing link hashes, and those aren't the
      // same from one run to the next.
      const discardedAdmission = {
        body: {
          type: 'ADMIT_MEMBER',
          payload: { memberKeys: redactKeys(charlie.user.keys) },
        },
      } as TeamLink
      const afterDiscarding = invalidLinkReducer(alice.team.state, discardedAdmission)
      expect(afterDiscarding.members.some(m => m.userId === charlie.userId)).toBe(true)
      expect(afterDiscarding.removedMembers.some(m => m.userId === charlie.userId)).toBe(true)

      // ✅ He's on the team, so a discarded link naming him in `removedMembers` doesn't lock him
      // out of it
      expect(validate(afterDiscarding, charliesLink).isValid).toBe(true)
    })

    it('can admit an invitee again after being removed and re-added', () => {
      const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

      // 👨🏻‍🦲 Bob admitted people before he was removed, and those links still replay: the rule
      // that stops an ex-member only speaks to what comes after the removal
      const { seed: firstSeed } = alice.team.inviteMember()
      bob.team.merge(alice.team.graph)
      bob.team.admitMember(
        generateProof(firstSeed, charlie.user.keys),
        charlie.user.keys,
        charlie.userName
      )
      alice.team.merge(bob.team.graph)
      expect(alice.team.has(charlie.userId)).toBe(true)

      // 👩🏾 Alice removes him and then thinks better of it
      alice.team.remove(bob.userId)
      alice.team.addForTesting(bob.user, [], redactDevice(bob.device))
      expect(alice.team.memberWasRemoved(bob.userId)).toBe(false)

      const { seed } = alice.team.inviteMember()
      const bobsTeam = loadTeam(alice.team.save(), bob.localContext, alice.team.teamKeyring())

      // ✅ The tombstone is gone, so he can admit again — and 👳🏽‍♂️ Charlie, whom he admitted
      // before the removal, is still on the team
      const dwight = createUser('dwight', 'dwight-user-id', 'dwight')
      bobsTeam.admitMember(generateProof(seed, dwight.keys), dwight.keys, dwight.userName)
      expect(bobsTeam.has(dwight.userId)).toBe(true)
      expect(bobsTeam.has(charlie.userId)).toBe(true)
    })

    it("doesn't do anything if asked to remove a nonexistent member", () => {
      const { alice } = setup('alice')

      // Try removing bob although he hasn't been added
      const removeBob = () => {
        alice.team.remove('bob')
      }

      expect(removeBob).not.toThrow()
    })

    it('gets an individual member', () => {
      const { alice, bob } = setup('alice', 'bob')
      const member = alice.team.members(bob.userId)
      expect(member.userName).toBe('bob')
    })

    it('throws if asked to get a nonexistent member', () => {
      const { alice } = setup('alice', 'bob')

      const getNed = () => alice.team.members('ned')
      expect(getNed).toThrow(/not found/)
    })

    it('lists all members', () => {
      const { alice, bob, charlie } = setup([
        'alice',
        { user: 'bob', member: false },
        { user: 'charlie', member: false },
      ])

      expect(alice.team.members()).toHaveLength(1)
      expect(alice.team.members().map(m => m.userName)).toEqual(['alice'])

      alice.team.addForTesting(bob.user)
      alice.team.addForTesting(charlie.user)
      expect(alice.team.members()).toHaveLength(3)
      expect(alice.team.members().map(m => m.userName)).toEqual(['alice', 'bob', 'charlie'])
    })
  })
})
