import {
  createKeyring,
  createKeyset,
  createUser,
  redactKeys,
  type UnixTimestamp,
} from '@localfirst/crdx'
import { signatures } from '@localfirst/crypto'
import { createDevice, redactDevice, Team, type FirstUseDevice } from 'index.js'
import {
  create as createInvitation,
  generateProof,
  hashKeys,
  type DeviceInvitation,
  type MemberInvitation,
} from 'invitation/index.js'
import * as teams from 'team/index.js'
import { KeyType } from 'util/index.js'
import { setup } from 'util/testing/index.js'
import { describe, expect, it } from 'vitest'

const { DEVICE, USER } = KeyType

describe('Team', () => {
  describe('invitations', () => {
    describe('members', () => {
      it('accepts valid proof of invitation', () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a random secret key
        const { seed } = alice.team.inviteMember()

        // 👨🏻‍🦲 Bob accepts the invitation
        const proofOfInvitation = generateProof(seed, bob.user.keys)

        // 👨🏻‍🦲 Bob shows 👩🏾 Alice his proof of invitation, and she lets him in, associating
        // him with the public keys he's provided
        alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.user.userName)

        // ✅ 👨🏻‍🦲 Bob is now on the team. Congratulations, Bob!
        expect(alice.team.has(bob.userId)).toBe(true)
      })

      it('lets you use a secret invitation seed of your choosing', () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a secret key of her choosing
        const seed = 'passw0rd'
        alice.team.inviteMember({ seed })

        const proofOfInvitation = generateProof(seed, bob.user.keys)

        alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.user.userName)

        // ✅ Still works
        expect(alice.team.has(bob.userId)).toBe(true)
      })

      it('normalizes the a secret invitation seed ', () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob
        const seed = 'abc def ghi'
        alice.team.inviteMember({ seed })

        // 👨🏻‍🦲 Bob accepts the invitation using a url-friendlier version of the key
        const proofOfInvitation = generateProof('abc+def+ghi', bob.user.keys)
        alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.user.userName)

        // ✅ Bob is on the team
        expect(alice.team.has(bob.userId)).toBe(true)
      })

      it('allows non-admins to accept an invitation', () => {
        const { alice, bob, charlie } = setup(
          'alice',
          { user: 'bob', admin: false },
          { user: 'charlie', member: false }
        )

        // 👩🏾 Alice invites 👳🏽‍♂️ Charlie by sending him a secret key
        const { seed } = alice.team.inviteMember()

        // 👳🏽‍♂️ Charlie accepts the invitation
        const proofOfInvitation = generateProof(seed, charlie.user.keys)

        // Later, 👩🏾 Alice is no longer around, but 👨🏻‍🦲 Bob is online
        let persistedTeam = alice.team.save()
        const bobsTeam = teams.load(persistedTeam, bob.localContext, alice.team.teamKeys())

        // Just to confirm: 👨🏻‍🦲 Bob isn't an admin
        expect(bobsTeam.memberIsAdmin(bob.userId)).toBe(false)

        // 👳🏽‍♂️ Charlie shows 👨🏻‍🦲 Bob his proof of invitation
        bobsTeam.admitMember(proofOfInvitation, charlie.user.keys, charlie.user.userName)

        // 👍👳🏽‍♂️ Charlie is now on the team
        expect(bobsTeam.has(charlie.userId)).toBe(true)

        // ✅ 👩🏾 Alice can now see that 👳🏽‍♂️ Charlie is on the team. Congratulations, Charlie!
        persistedTeam = bobsTeam.save()
        alice.team = teams.load(persistedTeam, alice.localContext, alice.team.teamKeys())
        expect(alice.team.has(charlie.userId)).toBe(true)
      })

      it("will use an invitation that hasn't expired yet", () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob with a future expiration date
        const expiration = new Date(Date.UTC(2999, 12, 25)).valueOf() as UnixTimestamp // NOTE 👩‍🚀 this test will fail if run in the distant future
        const { seed } = alice.team.inviteMember({ expiration })
        const proofOfInvitation = generateProof(seed, bob.user.keys)
        alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.user.userName)

        // ✅ 👨🏻‍🦲 Bob's invitation has not expired so he is on the team
        expect(alice.team.has(bob.userId)).toBe(true)
      })

      it("won't use an expired invitation", () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // A long time ago 👩🏾 Alice invited 👨🏻‍🦲 Bob
        const expiration = new Date(Date.UTC(2020, 12, 25)).valueOf() as UnixTimestamp
        const { seed } = alice.team.inviteMember({ expiration })
        const proofOfInvitation = generateProof(seed, bob.user.keys)

        const tryToAdmitBob = () => {
          alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.user.userName)
        }

        // 👎 👨🏻‍🦲 Bob's invitation has expired so he can't get in
        expect(tryToAdmitBob).toThrowError(/expired/)

        // ❌ 👨🏻‍🦲 Bob is not on the team
        expect(alice.team.has(bob.userId)).toBe(false)
      })

      it('can use an invitation multiple times', () => {
        const { alice, bob, charlie } = setup(
          'alice',
          { user: 'bob', member: false },
          { user: 'charlie', member: false }
        )

        const { seed } = alice.team.inviteMember({ maxUses: 2 })

        // 👨🏻‍🦲 Bob and 👳🏽‍♂️ Charlie each generate a proof from the same seed, bound to their own userIds
        const bobsProof = generateProof(seed, bob.user.keys)
        const charliesProof = generateProof(seed, charlie.user.keys)

        // 👩🏾 Alice admits them both

        alice.team.admitMember(bobsProof, bob.user.keys, bob.user.userName)
        alice.team.admitMember(charliesProof, charlie.user.keys, charlie.user.userName)

        // ✅ 👨🏻‍🦲 Bob and 👳🏽‍♂️ Charlie are both on the team
        expect(alice.team.has(bob.userId)).toBe(true)
        expect(alice.team.has(charlie.userId)).toBe(true)
      })

      it('can use an invitation infinite uses when maxUses is zero', () => {
        const { alice } = setup('alice')

        // 👩🏾 Alice makes an invitation that anyone can use
        const { seed } = alice.team.inviteMember({ maxUses: 0 }) // No limit

        // A bunch of people use the same invitation and 👩🏾 Alice admits them all
        const invitees = `
            amanda, bob, charlie, dwight, edwin, frida, gertrude, herbert, 
            ignaszi, joão, krishna, lashawn, mary, ngunda, oprah, phil, quân, 
            rainbow, steve, thad, uriah, vanessa, wade, xerxes, yazmin, zelda`
          .replaceAll(/\s/g, '')
          .split(',')
        for (const userId of invitees) {
          const userKeys = createKeyset({ type: USER, name: userId })
          alice.team.admitMember(generateProof(seed, userKeys), userKeys, userId)
        }

        // ✅ they're all on the team
        for (const userId of invitees) {
          expect(alice.team.has(userId)).toBe(true)
        }
      })

      it("won't use an invitation more than the maximum uses defined", () => {
        const { alice, bob, charlie } = setup(
          'alice',
          { user: 'bob', member: false },
          { user: 'charlie', member: false }
        )

        const { seed } = alice.team.inviteMember({ maxUses: 1 })

        // 👨🏻‍🦲 Bob and 👳🏽‍♂️ Charlie each generate a proof from the same seed, bound to their own userIds
        const bobsProof = generateProof(seed, bob.user.keys)
        const charliesProof = generateProof(seed, charlie.user.keys)

        const tryToAdmitBob = () => {
          alice.team.admitMember(bobsProof, bob.user.keys, bob.user.userName)
        }

        const tryToAdmitCharlie = () => {
          alice.team.admitMember(charliesProof, charlie.user.keys, charlie.user.userName)
        }

        // 👍 👨🏻‍🦲 Bob uses the invitation first and he gets in
        expect(tryToAdmitBob).not.toThrow()

        // 👎 👳🏽‍♂️ Charlie also tries to use the invitation, but it can only be used once
        expect(tryToAdmitCharlie).toThrow(/used/)

        // ✅ 👨🏻‍🦲 Bob is on the team
        expect(alice.team.has(bob.userId)).toBe(true)

        // ❌ 👳🏽‍♂️ Charlie is not on the team
        expect(alice.team.has(charlie.userId)).toBe(false)
      })

      it("won't use a revoked invitation", () => {
        const { alice, bob, charlie } = setup(
          'alice',
          { user: 'bob', admin: false },
          { user: 'charlie', member: false }
        )

        // 👩🏾 Alice invites 👳🏽‍♂️ Charlie by sending him a secret key
        const { seed, id } = alice.team.inviteMember()

        // 👳🏽‍♂️ Charlie accepts the invitation
        const proofOfInvitation = generateProof(seed, bob.user.keys)

        // 👩🏾 Alice changes her mind and revokes the invitation
        alice.team.revokeInvitation(id)

        // Later, 👩🏾 Alice is no longer around, but 👨🏻‍🦲 Bob is online
        const persistedTeam = alice.team.save()
        bob.team = teams.load(persistedTeam, bob.localContext, alice.team.teamKeys())

        // 👳🏽‍♂️ Charlie shows 👨🏻‍🦲 Bob his proof of invitation
        const tryToAdmitCharlie = () => {
          bob.team.admitMember(proofOfInvitation, charlie.user.keys, charlie.user.userName)
        }

        // 👎 But the invitation is rejected because it was revoked
        expect(tryToAdmitCharlie).toThrowError(/revoked/)

        // ❌ 👳🏽‍♂️ Charlie is not on the team
        expect(bob.team.has(charlie.userId)).toBe(false)
      })

      it("won't accept proof of invitation with an invalid signature", () => {
        const { alice, eve } = setup('alice', 'eve')
        const { team } = alice

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a random secret key
        const { seed: _seed } = alice.team.inviteMember()

        // 🦹‍♀️ Eve is a member of the group and she wants to hijack Bob's invitation for her
        // nefarious purposes. so she tries to create a proof of invitation.

        // She can get the id from the graph
        const invitation = Object.values(team.state.invitations)[0]
        const { id } = invitation

        const keyHash = hashKeys(eve.user.keys)
        const payload = { id, invitee: eve.userId, keyHash }
        const signature = signatures.sign(payload, eve.user.keys.signature.secretKey)
        const badProof = { id, invitee: eve.userId, keyHash, signature }

        // 🦹‍♀️ Eve shows 👩🏾 Alice her proof of invitation
        const submitBadProof = () => team.admitMember(badProof, eve.user.keys, 'bob')

        // 🦹‍♀️ GRRR I would've got away with it too, if it weren't for you meddling cryptographic algorithms!
        expect(submitBadProof).toThrow('Signature provided is not valid')
      })

      it('an invited member needs access to all generations of user and team keys', () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        const changeKeys = () => {
          const newKeys = { type: KeyType.USER, name: alice.userId }
          alice.team.changeKeys(createKeyset(newKeys))
        }

        // Alice rotates her keys two times
        changeKeys()
        changeKeys()

        // key rotation results in two new keys generations for team keys, admin keys and alice user keys
        expect(alice.team.teamKeys().generation).toBe(2)
        expect(alice.team.adminKeys().generation).toBe(2)
        expect(alice.team.members(alice.userId).keys.generation).toBe(2)
        expect(alice.user.keys.generation).toBe(2)
        expect(Object.values(alice.team.teamKeyring())).toHaveLength(3)
        expect(Object.values(alice.team.userKeyring())).toHaveLength(3)

        // 3 times 3 generations of team keys, admin keys, alice user keys
        expect(alice.team.state.lockboxes.length).toBe(9)

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a random secret key
        const { seed } = alice.team.inviteMember()

        // 👨🏻‍🦲 Bob accepts the invitation
        const proofOfInvitation = generateProof(seed, bob.user.keys)

        // 👨🏻‍🦲 Bob shows 👩🏾 Alice his proof of invitation, and she lets him in
        alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.user.userName)

        // ✅ Alice added 3 lockboxes to send 3 generations of team keys to Bob
        expect(alice.team.state.lockboxes.length).toBe(12)

        // 👩🏾 Alice sends 👨🏻‍🦲 Bob the team's graph and keyring
        const serializedGraph = alice.team.save()
        const teamKeyring = alice.team.teamKeyring()

        const bobTeam = new Team({
          source: serializedGraph,
          context: bob.localContext,
          teamKeyring,
        })
        bobTeam.join(teamKeyring, createKeyring(bob.user.keys))

        // ✅ 👨🏻‍🦲 Bob is now on the team
        expect(alice.team.has(bob.userId)).toBe(true)

        // ✅ Now Alice and Bob have each two members on the team
        expect(alice.team.members()).toHaveLength(2)
        expect(bobTeam.members()).toHaveLength(2)
        expect(bobTeam.has(alice.userId)).toBe(true)

        // ✅ Bob added 1 more lockbox for his user keys that can be unlocked by his device keys
        expect(bobTeam.state.lockboxes.length).toBe(13)

        // ✅ Bob has all 3 generations of team keys and 1 generation of his user keys
        expect(Object.values(bobTeam.teamKeyring())).toHaveLength(3)
        expect(Object.values(bobTeam.userKeyring())).toHaveLength(1)

        const serializedBobTeam = bobTeam.save()

        // In case some keys went missing while serializing and deserializing the team graph
        // on Bob's device, some required keys wouldn't be available to decrypt the graph,
        // resulting in the error "Can't decrypt link: don't have the correct keyset"
        expect(
          () =>
            new Team({
              source: serializedBobTeam,
              context: bob.localContext,
              teamKeyring: bobTeam.teamKeyring(),
            })
        ).not.toThrow()
      })

      it("won't accept proof of invitation with a username that is not unique", () => {
        const { alice, bob } = setup('alice', { user: 'bob', member: false })

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a random secret key
        const { seed } = alice.team.inviteMember()

        // 👨🏻‍🦲 Bob accepts the invitation
        const proofOfInvitation = generateProof(seed, bob.user.keys)

        // 👨🏻‍🦲 Bob shows 👩🏾 Alice his proof of invitation, but uses Alice's username
        const tryToAdmitBob = () => {
          alice.team.admitMember(proofOfInvitation, bob.user.keys, alice.user.userName)
        }

        // 👎 But the invitation is rejected because the username is not unique
        expect(tryToAdmitBob).toThrowError('Username is not unique within the team.')

        // ❌ 👨🏻‍🦲 Bob is not on the team
        expect(alice.team.has(bob.userId)).toBe(false)
      })

      it("won't accept proof of invitation with a userId that is not unique", () => {
        const { alice, eve } = setup('alice', { user: 'eve', member: false })

        // 👩🏾 Alice invites 🦹‍♀️ Eve by sending her a random secret key
        const { seed } = alice.team.inviteMember()

        // 🦹‍♀️ Eve prepares keys using Alice's userId
        const keysWithAliceUserId = {
          ...eve.user.keys,
          name: alice.userId,
        }

        // 🦹‍♀️ Eve accepts the invitation, binding her proof to those keys — which carry Alice's
        // userId, so that's what she'll present as her own
        const proofOfInvitation = generateProof(seed, keysWithAliceUserId)

        // 🦹‍♀️ Eve shows 👩🏾 Alice her proof of invitation, but uses Alice's userId
        const tryToAdmitEve = () => {
          alice.team.admitMember(proofOfInvitation, keysWithAliceUserId, eve.user.userName)
        }

        // 👎 But the invitation is rejected because the userId is not unique
        expect(tryToAdmitEve).toThrowError('userId is not unique within the team.')

        // ❌ 🦹‍♀️ Eve is not on the team
        expect(alice.team.has(eve.userId)).toBe(false)
        expect(
          alice.team.state.members.filter(({ userId }) => userId === alice.userId)
        ).toHaveLength(1)
        expect(alice.team.members(alice.userId).userName === alice.userName).toBe(true)
      })

      it("won't re-admit a removed member by replaying their published proof", () => {
        const { alice, bob, charlie } = setup(
          'alice',
          { user: 'bob', member: false },
          { user: 'charlie', admin: false }
        )

        // 👩🏾 Alice posts an invitation that can be used more than once, and admits 👨🏻‍🦲 Bob with it
        const { seed } = alice.team.inviteMember({ maxUses: 2 })
        const proofOfInvitation = generateProof(seed, bob.user.keys)
        alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.userName)
        expect(alice.team.has(bob.userId)).toBe(true)

        // 👩🏾 Alice removes 👨🏻‍🦲 Bob
        alice.team.remove(bob.userId)
        expect(alice.team.has(bob.userId)).toBe(false)

        // 👳🏽‍♂️ Charlie is an ordinary member, not an admin. Bob's proof is published on the graph
        // and the invitation still has a use left, so nothing stops him from replaying it — which
        // would put Bob back on the team and hand him lockboxes for the current team keys.
        charlie.team = teams.load(alice.team.save(), charlie.localContext, alice.team.teamKeyring())
        const replayBobsAdmission = () => {
          charlie.team.admitMember(proofOfInvitation, bob.user.keys, bob.userName)
        }

        expect(replayBobsAdmission).toThrowError(/userid belongs to a member who was removed/i)
        expect(charlie.team.has(bob.userId)).toBe(false)
      })

      it("won't admit someone under a removed member's userName", () => {
        const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })
        alice.team.remove(bob.userId)

        // 🦹‍♀️ Taking a removed member's name would let 👳🏽‍♂️ Charlie pass for them in anything
        // that goes by userName
        const { seed } = alice.team.inviteMember()
        const keysUnderCharliesOwnId = charlie.user.keys
        const admitCharlieAsBob = () => {
          alice.team.admitMember(
            generateProof(seed, keysUnderCharliesOwnId),
            keysUnderCharliesOwnId,
            bob.userName
          )
        }

        expect(admitCharlieAsBob).toThrowError(/username belongs to a member who was removed/i)
        expect(alice.team.has(charlie.userId)).toBe(false)
      })

      it('still admits a second, different member with a multi-use invitation', () => {
        const { alice, bob, charlie } = setup(
          'alice',
          { user: 'bob', member: false },
          { user: 'charlie', member: false }
        )

        // ✅ What a multi-use invitation is for: admitting more than one person
        const { seed } = alice.team.inviteMember({ maxUses: 2 })
        alice.team.admitMember(generateProof(seed, bob.user.keys), bob.user.keys, bob.userName)
        alice.team.admitMember(
          generateProof(seed, charlie.user.keys),
          charlie.user.keys,
          charlie.userName
        )

        expect(alice.team.has(bob.userId)).toBe(true)
        expect(alice.team.has(charlie.userId)).toBe(true)
      })

      it('still lets an admin add a removed member back', () => {
        const { alice, bob } = setup('alice', 'bob')
        alice.team.remove(bob.userId)
        expect(alice.team.has(bob.userId)).toBe(false)

        // ✅ Re-admitting someone is still possible — but through ADD_MEMBER, which is admin-only,
        // rather than by any member replaying a proof
        alice.team.addForTesting(bob.user)
        expect(alice.team.has(bob.userId)).toBe(true)
        expect(alice.team.memberWasRemoved(bob.userId)).toBe(false)
      })

      it("won't accept a proof replayed under someone else's keys", () => {
        const { alice, bob, eve } = setup(
          'alice',
          { user: 'bob', member: false },
          { user: 'eve', member: false }
        )

        // 👩🏾 Alice invites 👨🏻‍🦲 Bob by sending him a random secret key
        const { seed } = alice.team.inviteMember()

        // 👨🏻‍🦲 Bob generates his proof of invitation
        const proofOfInvitation = generateProof(seed, bob.user.keys)

        // 🦹‍♀️ Eve intercepts Bob's proof and presents it as her own, under her own keys
        const tryToAdmitEve = () => {
          alice.team.admitMember(proofOfInvitation, eve.user.keys, eve.user.userName)
        }

        // 👎 The proof is bound to 👨🏻‍🦲 Bob, so it doesn't get 🦹‍♀️ Eve in
        expect(tryToAdmitEve).toThrowError(/issued to a different user/i)

        // ❌ 🦹‍♀️ Eve is not on the team
        expect(alice.team.has(eve.userId)).toBe(false)

        // ✅ 👨🏻‍🦲 Bob can still use his own proof
        alice.team.admitMember(proofOfInvitation, bob.user.keys, bob.user.userName)
        expect(alice.team.has(bob.userId)).toBe(true)
      })

      it("won't accept a proof that names someone other than the keys being admitted", () => {
        const { alice, bob, eve } = setup(
          'alice',
          { user: 'bob', member: false },
          { user: 'eve', member: false }
        )

        const { seed } = alice.team.inviteMember()

        // 🦹‍♀️ Eve knows the seed, so she can mint a proof — but only one naming herself
        const proofNamingEve = generateProof(seed, eve.user.keys)

        // She can't use it to get 👨🏻‍🦲 Bob's keys admitted
        const tryToAdmitBob = () => {
          alice.team.admitMember(proofNamingEve, bob.user.keys, bob.user.userName)
        }

        expect(tryToAdmitBob).toThrowError(/issued to a different user/i)
        expect(alice.team.has(bob.userId)).toBe(false)
      })

      describe('devices', () => {
        it("won't accept a device proof replayed for a different device", () => {
          const { alice: aliceLaptop } = setup('alice')
          const alicePhone = redactDevice(aliceLaptop.phone!)

          // 💻 on her laptop, Alice generates an invitation for her 📱 phone
          const { seed } = aliceLaptop.team.inviteDevice()

          // 📱 the phone generates a proof bound to itself
          const proofOfInvitation = generateProof(seed, alicePhone.keys)

          // 🦹‍♀️ Eve intercepts the proof and presents it for a device she controls
          const evesDevice = redactDevice(
            createDevice({ userId: aliceLaptop.userId, deviceName: 'eves device' })
          )
          const tryToAdmitEvesDevice = () => {
            aliceLaptop.team.admitDevice(proofOfInvitation, evesDevice)
          }

          expect(tryToAdmitEvesDevice).toThrowError(/issued to a different device/i)
          expect(aliceLaptop.team.members(aliceLaptop.userId).devices).toHaveLength(1)

          // ✅ the real phone can still use its own proof
          aliceLaptop.team.admitDevice(proofOfInvitation, alicePhone)
          expect(aliceLaptop.team.members(aliceLaptop.userId).devices).toHaveLength(2)
        })

        it('creates and accepts an invitation for a device', () => {
          const { alice: aliceLaptop } = setup('alice')
          const alicePhone = aliceLaptop.phone!

          // 👩🏾 Alice only has 💻 one device on the signature chain
          expect(aliceLaptop.team.members(aliceLaptop.userId).devices).toHaveLength(1)

          // 💻 on her laptop, Alice generates an invitation for her phone
          const { seed } = aliceLaptop.team.inviteDevice()

          // 📱 Alice gets the seed to her phone, perhaps by typing it in or by scanning a QR code.

          // Alice's phone uses the seed to generate her starter keys and her proof of invitation
          const proofOfInvitation = generateProof(seed, alicePhone.keys)

          // 📱 Alice's phone connects with 💻 her laptop and presents the proof
          aliceLaptop.team.admitDevice(proofOfInvitation, redactDevice(alicePhone))

          // 👍 The proof was good, so the laptop sends the phone the team's graph and keyring
          const serializedGraph = aliceLaptop.team.save()
          const teamKeyring = aliceLaptop.team.teamKeyring()

          // 📱 Alice's phone needs to get her user keys.

          // To do that, she uses the invitation seed to generate starter keys, which she can use to
          // unlock a lockbox stored on the graph containing her user keys.
          const { user: aliceUser } = teams.getDeviceUserFromGraph({
            serializedGraph,
            teamKeyring,
            invitationSeed: seed,
          })

          const phoneTeam = teams.load(
            serializedGraph,
            { user: aliceUser, device: alicePhone },
            teamKeyring
          )

          // ✅ Now Alice has 💻📱 two devices on the signature chain
          expect(phoneTeam.members(aliceLaptop.userId).devices).toHaveLength(2)
          expect(aliceLaptop.team.members(aliceLaptop.userId).devices).toHaveLength(2)
        })

        it("lets someone else admit Alice's device", () => {
          const { alice, bob } = setup('alice', 'bob')

          // 👩🏾 Alice only has 💻 one device on the signature chain
          expect(alice.team.members(alice.userId).devices).toHaveLength(1)

          // 💻 on her laptop, Alice generates an invitation for her phone
          const { seed } = alice.team.inviteDevice()

          // 📱 Alice gets the seed to her phone, perhaps by typing it in or by scanning a QR code.

          // Alice's phone uses the seed to generate her starter keys and her proof of invitation
          const proofOfInvitation = generateProof(seed, alice.phone!.keys)

          // 👨🏻‍🦲 Bob syncs up with Alice
          const savedTeam = alice.team.save()
          bob.team = teams.load(savedTeam, bob.localContext, alice.team.teamKeys())

          // 📱 Alice's phone connects with 👨🏻‍🦲 Bob and she presents the proof
          bob.team.admitDevice(proofOfInvitation, redactDevice(alice.phone!))
        })

        it("won't accept proof of invitation with an invalid signature", () => {
          const { alice, eve } = setup('alice', 'eve')

          // 👩🏾 Alice only has 💻 one device on the signature chain
          expect(alice.team.members(alice.userId).devices).toHaveLength(1)

          // 💻 on her laptop, Alice generates an invitation for her phone
          const _seed = alice.team.inviteDevice().seed

          // 🦹‍♀️ Eve is a member of the group and she wants to hijack Alice's device invitation
          // for her nefarious purposes. so she tries to create a proof of invitation.

          // She can get the id from the graph
          const invitation = Object.values(alice.team.state.invitations)[0]
          const { id } = invitation

          const keyHash = hashKeys(eve.device.keys)
          const payload = { id, invitee: eve.device.deviceId, keyHash }
          const signature = signatures.sign(payload, eve.user.keys.signature.secretKey)
          const badProof = { id, invitee: eve.device.deviceId, keyHash, signature }

          // 🦹‍♀️ Eve shows 👩🏾 Alice her proof of invitation
          const submitBadProof = () =>
            alice.team.admitDevice(badProof, redactDevice(eve.device) as FirstUseDevice)

          // 🦹‍♀️ GRRR I would've got away with it too, if it weren't for you meddling cryptographic algorithms!
          expect(submitBadProof).toThrow('Signature provided is not valid')
        })

        it('an invited device needs access to all generations of user and team keys', () => {
          const { alice: aliceLaptop } = setup('alice')
          const alicePhone = aliceLaptop.phone!

          const changeKeys = () => {
            const newKeys = createKeyset({ type: KeyType.USER, name: aliceLaptop.userId })
            aliceLaptop.team.changeKeys(newKeys)
          }

          // Alice rotates her keys two times
          changeKeys()
          changeKeys()

          // key rotation results in two new generations of keys
          expect(aliceLaptop.team.teamKeys().generation).toBe(2)
          expect(aliceLaptop.team.adminKeys().generation).toBe(2)
          expect(aliceLaptop.team.members(aliceLaptop.userId).keys.generation).toBe(2)
          expect(aliceLaptop.user.keys.generation).toBe(2)

          expect(Object.values(aliceLaptop.team.teamKeyring())).toHaveLength(3) // 3 generations of team keys
          expect(Object.values(aliceLaptop.team.userKeyring())).toHaveLength(3) // 3 generations of user keys

          // 3 generations each of team keys, admin keys, alice user keys = 9 keys total
          expect(aliceLaptop.team.state.lockboxes.length).toBe(9)

          // Alice invites and admits her phone
          const { seed } = aliceLaptop.team.inviteDevice()
          const proofOfInvitation = generateProof(seed, alicePhone.keys)
          aliceLaptop.team.admitDevice(proofOfInvitation, redactDevice(alicePhone))

          // upon creating the invitation, Alice's laptop added 3 lockboxes containing 3 generations
          // of user keys that can be opened by Alice's phone using the starter keys
          expect(aliceLaptop.team.state.lockboxes.length).toBe(12)

          // the laptop sends the phone the team's graph and keyring
          const serializedGraph = aliceLaptop.team.save()
          const teamKeyring = aliceLaptop.team.teamKeyring()

          // 📱 Alice's phone needs to get her user keys.

          // Alice's laptop also sends all generations of user keys in encrypted lockboxes for each key,
          // which Alice's phone decrypts using her starter keys generated from the invitation seed.
          // Alice's phone needs every generation of user keys to unlock every generation of team keys so
          // the phone can decrypt the whole team graph using all the secret keys of the team keys generations.
          const { user: aliceUser, userKeyring } = teams.getDeviceUserFromGraph({
            serializedGraph,
            teamKeyring,
            invitationSeed: seed,
          })

          // Alice's phone now has everything it needs to decrypt the team graph and join the team
          const phoneTeam = new Team({
            source: serializedGraph,
            context: { user: aliceUser, device: alicePhone },
            teamKeyring,
          })
          phoneTeam.join(teamKeyring, userKeyring)

          // ✅ Now Alice has 💻📱 two devices on the signature chain
          expect(phoneTeam.members(aliceLaptop.userId).devices).toHaveLength(2)
          expect(aliceLaptop.team.members(aliceLaptop.userId).devices).toHaveLength(2)

          // Alice's phone added 3 more lockboxes for 3 generations of user keys while joining,
          // this time using it's own secret device keys for encryption
          expect(phoneTeam.state.lockboxes.length).toBe(15)

          // Alice's phone has all user keys and team keys generations, the latest admin keys,
          // and the latest user keys
          expect(Object.values(phoneTeam.teamKeyring())).toHaveLength(3)
          expect(Object.values(phoneTeam.userKeyring())).toHaveLength(3)
          expect(phoneTeam.adminKeys().generation).toBe(2)
          expect(phoneTeam.members(aliceLaptop.userId).keys.generation).toBe(2)

          const serializedPhoneTeam = phoneTeam.save()

          // If we didn't have all the keys we needed, this would throw "Can't decrypt link: don't have the correct keyset"
          expect(
            () =>
              new Team({
                source: serializedPhoneTeam,
                context: { user: aliceUser, device: alicePhone },
                teamKeyring: phoneTeam.teamKeyring(),
              })
          ).not.toThrow()
        })
      })

      describe('admission is verifiable by every peer', () => {
        it("won't accept an admission whose proof isn't signed with the invitation key", () => {
          const { alice, bob, eve } = setup(
            'alice',
            { user: 'bob', member: false },
            { user: 'eve', admin: false }
          )

          // 👩🏾 Alice invites 👨🏻‍🦲 Bob
          const { id } = alice.team.inviteMember()

          // 🦹‍♀️ Eve is a member, so she syncs up and holds the team keys; that lets her author
          // links directly, without going through `admitMember`. She fabricates a proof and posts
          // an admission with it.
          eve.team = teams.load(alice.team.save(), eve.localContext, alice.team.teamKeys())
          const keyHash = hashKeys(bob.user.keys)
          const signature = signatures.sign(
            { id, invitee: bob.userId, keyHash },
            eve.user.keys.signature.secretKey
          )
          const forgedProof = { id, invitee: bob.userId, keyHash, signature }

          const admitWithForgedProof = () => {
            eve.team.dispatch({
              type: 'ADMIT_MEMBER',
              payload: {
                id,
                userName: bob.userName,
                memberKeys: redactKeys(bob.user.keys),
                proof: forgedProof,
                lockboxes: [],
              },
            })
          }

          // 👎 Every peer runs this through the reducer, so nobody accepts it
          expect(admitWithForgedProof).toThrowError(/invalid proof of invitation/i)
          expect(eve.team.has(bob.userId)).toBe(false)
        })

        it("won't accept an admission whose proof names a different member", () => {
          const { alice, bob, eve } = setup(
            'alice',
            { user: 'bob', member: false },
            { user: 'eve', admin: false }
          )

          // 👩🏾 Alice invites 👨🏻‍🦲 Bob, and 👨🏻‍🦲 Bob generates a real proof
          const { seed, id } = alice.team.inviteMember()
          const bobsProof = generateProof(seed, bob.user.keys)

          // 🦹‍♀️ Eve syncs up, gets hold of Bob's proof, and posts an admission that attaches it to
          // her own choice of keys
          eve.team = teams.load(alice.team.save(), eve.localContext, alice.team.teamKeys())
          const mallory = createUser('mallory', 'mallory-user-id', 'mallory')
          const admitSomeoneElse = () => {
            eve.team.dispatch({
              type: 'ADMIT_MEMBER',
              payload: {
                id,
                userName: mallory.userName,
                memberKeys: redactKeys(mallory.keys),
                proof: bobsProof,
                lockboxes: [],
              },
            })
          }

          // 👎 The proof only admits the identity it names
          expect(admitSomeoneElse).toThrowError(/can't be used to admit/i)
          expect(eve.team.has(mallory.userId)).toBe(false)
        })

        it("won't accept a device admission whose proof names a different device", () => {
          const { alice, eve } = setup('alice', { user: 'eve', admin: false })

          // 👩🏾 Alice invites 📱 her phone, and the phone generates a real proof
          const { seed, id } = alice.team.inviteDevice()
          const phonesProof = generateProof(seed, alice.phone!.keys)

          // 🦹‍♀️ Eve syncs up, then posts an admission attaching the phone's proof to a device she
          // controls
          eve.team = teams.load(alice.team.save(), eve.localContext, alice.team.teamKeys())
          const evesDevice = redactDevice(
            createDevice({ userId: alice.userId, deviceName: 'eves device' })
          )
          const admitSomeoneElsesDevice = () => {
            eve.team.dispatch({
              type: 'ADMIT_DEVICE',
              payload: { id, device: evesDevice, proof: phonesProof, lockboxes: [] },
            })
          }

          // 👎 The proof only admits the device it names
          expect(admitSomeoneElsesDevice).toThrowError(/can't be used to admit/i)
          expect(eve.team.hasDevice(evesDevice.deviceId)).toBe(false)
        })

        it("won't accept an admission under keys the invitee didn't choose", () => {
          const { alice, bob, eve } = setup(
            'alice',
            { user: 'bob', member: false },
            { user: 'eve', admin: false }
          )

          // 👩🏾 Alice invites 👨🏻‍🦲 Bob, and 👨🏻‍🦲 Bob generates a real proof under his own keys
          const { seed, id } = alice.team.inviteMember()
          const bobsProof = generateProof(seed, bob.user.keys)

          // 🦹‍♀️ Eve relays for 👨🏻‍🦲 Bob, so she receives his genuine proof. She syncs up and posts
          // the admission herself, naming him — but under keys she made up and holds the secrets
          // for. Every other check passes: the proof is valid, it names the identity being
          // admitted, the invitation is a member invitation, and the userId is unused. If this
          // stood, she could author links as 👨🏻‍🦲 Bob and register devices under him: she would
          // BE him.
          eve.team = teams.load(alice.team.save(), eve.localContext, alice.team.teamKeys())
          const evesKeysInBobsName = redactKeys(createKeyset({ type: USER, name: bob.userId }))
          const admitBobUnderEvesKeys = () => {
            eve.team.dispatch({
              type: 'ADMIT_MEMBER',
              payload: {
                id,
                userName: bob.userName,
                memberKeys: evesKeysInBobsName,
                proof: bobsProof,
                lockboxes: [],
              },
            })
          }

          // 👎 The proof commits to the keyset 👨🏻‍🦲 Bob chose, so it can't be spent on another one
          expect(admitBobUnderEvesKeys).toThrowError(/commits to a different keyset/i)
          expect(eve.team.has(bob.userId)).toBe(false)

          // ✅ 👨🏻‍🦲 Bob's own keys still go through on the same proof
          eve.team.admitMember(bobsProof, redactKeys(bob.user.keys), bob.userName)
          expect(eve.team.has(bob.userId)).toBe(true)
        })

        it("won't accept a device admission under keys the device didn't choose", () => {
          const { alice, bob } = setup('alice', 'bob')
          const alicePhone = redactDevice(alice.phone!)

          // 👩🏾 Alice invites 📱 her phone, and the phone generates a real proof under its own keys
          const { seed, id } = alice.team.inviteDevice()
          const phonesProof = generateProof(seed, alicePhone.keys)

          // 👨🏻‍🦲 Bob relays for the phone, so he receives its genuine proof. He posts the
          // admission with the phone's own deviceId, but with device keys of his own making.
          bob.team = teams.load(alice.team.save(), bob.localContext, alice.team.teamKeys())
          const bobsKeysInThePhonesName = redactKeys(
            createKeyset({ type: DEVICE, name: alicePhone.deviceId })
          )
          const admitThePhoneUnderBobsKeys = () => {
            bob.team.dispatch({
              type: 'ADMIT_DEVICE',
              payload: {
                id,
                device: { ...alicePhone, keys: bobsKeysInThePhonesName },
                proof: phonesProof,
                lockboxes: [],
              },
            })
          }

          // 👎 The proof commits to the keyset the phone chose
          expect(admitThePhoneUnderBobsKeys).toThrowError(/commits to a different keyset/i)
          expect(bob.team.members(alice.userId).devices).toHaveLength(1)

          // ✅ The phone's own keys still go through on the same proof
          bob.team.admitDevice(phonesProof, alicePhone)
          expect(bob.team.members(alice.userId).devices).toHaveLength(2)
        })

        it("won't admit a device onto another member's account", () => {
          const { alice, bob } = setup('alice', { user: 'bob', admin: false })

          // 👨🏻‍🦲 Bob invites a device of his own, the ordinary way — the invitation names him as
          // the owner
          const { seed, id } = bob.team.inviteDevice()

          // He holds the seed, so he can mint a real proof for a device he controls
          const bobsOtherDevice = redactDevice(
            createDevice({ userId: bob.userId, deviceName: 'bobs other device' })
          )
          const proof = generateProof(seed, bobsOtherDevice.keys)

          // But he posts the admission with 👩🏾 Alice named as the owner. `admitDevice` takes the
          // owner from the invitation, but that only binds the admitter's own copy — every other
          // peer used to attach the device to whoever the payload named.
          const admitOntoAlicesAccount = () => {
            bob.team.dispatch({
              type: 'ADMIT_DEVICE',
              payload: {
                id,
                device: { ...bobsOtherDevice, userId: alice.userId },
                proof,
                lockboxes: [],
              },
            })
          }

          expect(admitOntoAlicesAccount).toThrowError(/can't be used to add a device to/i)

          // ❌ 👩🏾 Alice still has only her own device, so nobody resolves Bob's device to her
          expect(bob.team.members(alice.userId).devices).toHaveLength(1)
          expect(bob.team.hasDevice(bobsOtherDevice.deviceId)).toBe(false)
        })

        it("won't accept a device invitation issued in another member's name", () => {
          const { alice, bob } = setup('alice', { user: 'bob', admin: false })

          // 👨🏻‍🦲 Bob authors a device invitation naming 👩🏾 Alice as the owner. If this stood, he
          // could mint a proof from his own seed and admit a device of his own onto her account —
          // and the owner would match the invitation, so that admission would look proper.
          const invitationForAlice = createInvitation({
            kind: 'DEVICE',
            seed: 'passw0rd',
            userId: alice.userId,
          })
          const inviteADeviceForAlice = () => {
            bob.team.dispatch({
              type: 'INVITE_DEVICE',
              payload: { invitation: invitationForAlice },
            })
          }

          expect(inviteADeviceForAlice).toThrowError(
            /device invitation has to be for the member issuing it/i
          )
          expect(Object.keys(bob.team.state.invitations)).toHaveLength(0)
        })

        it("won't admit a member using a device invitation", () => {
          const { bob, eve } = setup(
            'alice',
            { user: 'bob', admin: false },
            { user: 'eve', member: false }
          )

          // 👨🏻‍🦲 Bob is an ordinary member, so he isn't allowed to invite a member — but anyone
          // can invite a device, and he holds that seed
          const { seed, id } = bob.team.inviteDevice()

          // `generateProof` signs whatever invitee string it's handed, so he mints one naming
          // 🦹‍♀️ Eve's userId rather than a deviceId
          const proof = generateProof(seed, eve.user.keys)

          // ...and presents his device invitation as though it admitted a member
          const admitEveAsAMember = () => {
            bob.team.dispatch({
              type: 'ADMIT_MEMBER',
              payload: {
                id,
                userName: eve.userName,
                memberKeys: redactKeys(eve.user.keys),
                proof,
                lockboxes: [],
              },
            })
          }

          // 👎 An invitation only admits the kind of invitee it was issued for
          expect(admitEveAsAMember).toThrowError(
            /device invitation.*can't be used to admit a member/i
          )

          // ❌ Bringing a new member onto the team is still an admin's call
          expect(bob.team.has(eve.userId)).toBe(false)
        })

        it("won't admit a device using a member invitation", () => {
          const { alice } = setup('alice')
          const alicePhone = redactDevice(alice.phone!)

          // 👩🏾 Alice invites a member, then tries to spend that invitation on a device
          const { seed, id } = alice.team.inviteMember()
          const proof = generateProof(seed, alicePhone.keys)

          const admitADeviceInstead = () => {
            alice.team.dispatch({
              type: 'ADMIT_DEVICE',
              payload: { id, device: alicePhone, proof, lockboxes: [] },
            })
          }

          expect(admitADeviceInstead).toThrowError(
            /member invitation.*can't be used to admit a device/i
          )
          expect(alice.team.members(alice.userId).devices).toHaveLength(1)
        })

        it("won't accept an INVITE_MEMBER link carrying a device invitation", () => {
          const { alice, bob } = setup('alice', 'bob')

          // 👩🏾 Alice is an admin, so she may invite members. `inviteMember` can only produce a
          // member invitation, so she authors the link herself and marks the invitation as a device
          // invitation for 👨🏻‍🦲 Bob. If it stood, she could spend it on a device admission and
          // put a device of her own onto his account.
          const deviceInvitationForBob = createInvitation({
            kind: 'DEVICE',
            seed: 'passw0rd',
            userId: bob.userId,
          })
          const postDeviceInvitationAsMemberInvitation = () => {
            alice.team.dispatch({
              type: 'INVITE_MEMBER',
              payload: { invitation: deviceInvitationForBob as unknown as MemberInvitation },
            })
          }

          expect(postDeviceInvitationAsMemberInvitation).toThrowError(
            /invite_member link has to carry a member invitation/i
          )
          expect(Object.keys(alice.team.state.invitations)).toHaveLength(0)
        })

        it("won't accept an INVITE_DEVICE link carrying a member invitation", () => {
          const { bob } = setup('alice', { user: 'bob', admin: false })

          // Inviting a member is admin-only, but inviting a device is open to every member. 👨🏻‍🦲
          // Bob is an ordinary member, so he authors an INVITE_DEVICE link carrying a MEMBER
          // invitation. If the kind went unchecked he could then spend it on a member admission and
          // hand an outsider full membership — and the team keyring — without ever being an admin.
          const memberInvitation = createInvitation({ kind: 'MEMBER', seed: 'passw0rd' })
          const postMemberInvitationAsDeviceInvitation = () => {
            bob.team.dispatch({
              type: 'INVITE_DEVICE',
              payload: { invitation: memberInvitation as unknown as DeviceInvitation },
            })
          }

          expect(postMemberInvitationAsDeviceInvitation).toThrowError(
            /invite_device link has to carry a device invitation/i
          )
          expect(Object.keys(bob.team.state.invitations)).toHaveLength(0)
        })

        it("won't accept an INVITE_MEMBER link with no invitation on it", () => {
          const { alice } = setup('alice')

          // A link that names no invitation at all used to get past the validators, and then blew
          // up in the reducer while every peer was replaying the chain
          const postAnEmptyInvitation = () => {
            alice.team.dispatch({
              type: 'INVITE_MEMBER',
              payload: {} as { invitation: MemberInvitation },
            })
          }

          expect(postAnEmptyInvitation).toThrowError(/has to carry an invitation/i)
          expect(Object.keys(alice.team.state.invitations)).toHaveLength(0)
        })

        it("won't accept an INVITE_DEVICE link with no invitation on it", () => {
          const { bob } = setup('alice', { user: 'bob', admin: false })

          const postAnEmptyInvitation = () => {
            bob.team.dispatch({
              type: 'INVITE_DEVICE',
              payload: {} as { invitation: DeviceInvitation },
            })
          }

          expect(postAnEmptyInvitation).toThrowError(/has to carry an invitation/i)
          expect(Object.keys(bob.team.state.invitations)).toHaveLength(0)
        })

        it('still admits each kind of invitee with its own kind of invitation', () => {
          const { alice, bob } = setup('alice', { user: 'bob', member: false })

          // ✅ A member invitation admits a member
          const { seed: memberSeed } = alice.team.inviteMember()
          alice.team.admitMember(
            generateProof(memberSeed, bob.user.keys),
            bob.user.keys,
            bob.userName
          )
          expect(alice.team.has(bob.userId)).toBe(true)

          // ✅ A device invitation admits a device
          const alicePhone = redactDevice(alice.phone!)
          const { seed: deviceSeed } = alice.team.inviteDevice()
          alice.team.admitDevice(generateProof(deviceSeed, alicePhone.keys), alicePhone)
          expect(alice.team.members(alice.userId).devices).toHaveLength(2)
        })

        it('accepts a legitimate device admission when replayed by another peer', () => {
          const { alice, bob } = setup('alice', 'bob')
          const alicePhone = redactDevice(alice.phone!)

          // 👩🏾 Alice invites and admits 📱 her phone in the normal way
          const { seed } = alice.team.inviteDevice()
          alice.team.admitDevice(generateProof(seed, alicePhone.keys), alicePhone)

          // ✅ 👨🏻‍🦲 Bob replays Alice's chain and independently accepts the admission
          bob.team = teams.load(alice.team.save(), bob.localContext, alice.team.teamKeys())
          expect(bob.team.members(alice.userId).devices).toHaveLength(2)
          expect(bob.team.memberByDeviceId(alicePhone.deviceId).userId).toBe(alice.userId)
        })

        it('accepts a legitimate admission when replayed by another peer', () => {
          const { alice, bob, charlie } = setup('alice', { user: 'bob', member: false }, 'charlie')

          // 👩🏾 Alice invites and admits 👨🏻‍🦲 Bob in the normal way
          const { seed } = alice.team.inviteMember()
          alice.team.admitMember(generateProof(seed, bob.user.keys), bob.user.keys, bob.userName)

          // ✅ 👳🏽‍♂️ Charlie replays Alice's chain and independently accepts the admission
          charlie.team = teams.load(alice.team.save(), charlie.localContext, alice.team.teamKeys())
          expect(charlie.team.has(bob.userId)).toBe(true)
        })
      })
    })
  })
})
