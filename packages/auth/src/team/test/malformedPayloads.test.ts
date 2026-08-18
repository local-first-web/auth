import { createKeyset, redactKeys, type Base58, type Keyset } from '@localfirst/crdx'
import { redactDevice, type Device } from 'index.js'
import { generateProof, type MemberInvitation } from 'invitation/index.js'
import * as teams from 'team/index.js'
import { redactUser } from 'team/redactUser.js'
import { type Member } from 'team/types.js'
import { KeyType } from 'util/index.js'
import { setup } from 'util/testing/index.js'
import { describe, expect, it } from 'vitest'

const { USER } = KeyType

/**
 * These all go through `dispatch`, because that's the only way a payload like this arrives: the
 * methods on `Team` build their payloads from typed arguments, and a peer replaying the chain has
 * no say in what's on it. What each one is checking is that the link is REFUSED — that the failure
 * is a validation error naming the field, and not a TypeError thrown out of the middle of a replay
 * that every peer would pay again, forever.
 *
 * Both spellings of nothing are here on purpose. A field left off a payload arrives as `undefined`,
 * but one explicitly set to `null` survives the round trip as `null`.
 */
describe('Team', () => {
  describe('a link with a malformed payload', () => {
    it("won't accept a ROOT link with no founding member or device", () => {
      const { alice } = setup('alice')

      // A ROOT link can be dispatched onto a team that already exists, which is its own problem
      // (auth-1dh) — but it's also the only way to hand these validators a ROOT payload, and what
      // this test is about is that a payload with nothing in it gets refused rather than
      // dereferenced.
      const postARootLink = (payload: Record<string, unknown>) => () => {
        alice.team.dispatch({ type: 'ROOT', payload } as never)
      }

      expect(postARootLink({ name: 'nope', rootDevice: redactDevice(alice.device) })).toThrowError(
        /has to carry a founding member/i
      )
      expect(postARootLink({ name: 'nope', rootMember: redactUser(alice.user) })).toThrowError(
        /has to carry a founding device/i
      )
      expect(
        postARootLink({
          name: 'nope',
          rootMember: { ...redactUser(alice.user), userName: null },
          rootDevice: redactDevice(alice.device),
        })
      ).toThrowError(/needs a usable userName/)
    })

    it("won't accept an ADD_MEMBER link with no member on it", () => {
      const { alice, bob } = setup('alice', { user: 'bob', member: false })

      const addNoMember = (member: unknown) => () => {
        alice.team.dispatch({
          type: 'ADD_MEMBER',
          payload: { member: member as Member },
        })
      }

      expect(addNoMember(undefined)).toThrowError(/has to carry a member/i)
      expect(addNoMember(null)).toThrowError(/has to carry a member/i)
      expect(alice.team.members()).toHaveLength(1)

      // ✅ A member with everything on them still goes on the team
      alice.team.addForTesting(bob.user, [], redactDevice(bob.device))
      expect(alice.team.has(bob.userId)).toBe(true)
    })

    it("won't accept an ADD_DEVICE link with no device on it", () => {
      const { bob } = setup('alice', { user: 'bob', admin: false })
      const bobsPhone = redactDevice(bob.phone!)

      // A link with no device at all used to get as far as `canOnlyAddYourOwnDevices`, which reads
      // `device.userId` — a TypeError paid by every peer replaying the chain
      const addNoDevice = (device: unknown) => () => {
        bob.team.dispatch({ type: 'ADD_DEVICE', payload: { device: device as Device } })
      }

      expect(addNoDevice(undefined)).toThrowError(/has to carry a device/i)
      expect(addNoDevice(null)).toThrowError(/has to carry a device/i)
      expect(bob.team.members(bob.userId).devices).toHaveLength(1)

      // ✅ A device with everything on it still goes onto his account
      bob.team.dispatch({ type: 'ADD_DEVICE', payload: { device: bobsPhone } })
      expect(bob.team.members(bob.userId).devices).toHaveLength(2)
    })

    it("won't accept a device with no identifiers of its own", () => {
      const { bob } = setup('alice', { user: 'bob', admin: false })
      const bobsPhone = redactDevice(bob.phone!)

      // 👨🏻‍🦲 Bob authors the link himself, so nothing has filled these in for him. `memberByDeviceId`
      // is what resolves a connecting peer to a member, and a device filed under nothing at all is
      // worse than one that crashes, because it doesn't crash.
      const addDevice = (device: Device) => () => {
        bob.team.dispatch({ type: 'ADD_DEVICE', payload: { device } })
      }

      expect(addDevice({ ...bobsPhone, deviceId: '' })).toThrowError(/needs a usable deviceId/)
      expect(addDevice({ ...bobsPhone, userId: null as unknown as string })).toThrowError(
        /needs a usable userId/
      )
      expect(bob.team.members(bob.userId).devices).toHaveLength(1)

      // ✅ The same device under its own identifiers still goes through
      bob.team.dispatch({ type: 'ADD_DEVICE', payload: { device: bobsPhone } })
      expect(bob.team.members(bob.userId).devices).toHaveLength(2)
    })

    it("won't accept a CHANGE_MEMBER_KEYS link with no keyset on it", () => {
      const { bob } = setup('alice', { user: 'bob', admin: false })

      // `canOnlyChangeYourOwnKeys` reads `keys.name` to see whose keys these are, and the
      // `changeMemberKeys` transform reads it again to find them on the team
      const changeKeys = (keys: unknown) => () => {
        bob.team.dispatch({
          type: 'CHANGE_MEMBER_KEYS',
          payload: { keys: keys as Keyset },
        })
      }

      expect(changeKeys(undefined)).toThrowError(/has to carry a keyset/i)
      expect(changeKeys(null)).toThrowError(/has to carry a keyset/i)
      expect(bob.team.members(bob.userId).keys.generation).toBe(0)

      // ✅ A keyset that names him still replaces his own
      bob.team.changeKeys(createKeyset({ type: USER, name: bob.userId }))
      expect(bob.team.members(bob.userId).keys.generation).toBe(1)
    })

    it("won't accept an INVITE link with no invitation on it", () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: false })

      const inviteAMember = (invitation: unknown) => () => {
        alice.team.dispatch({
          type: 'INVITE_MEMBER',
          payload: { invitation: invitation as MemberInvitation },
        })
      }

      const inviteADevice = (invitation: unknown) => () => {
        bob.team.dispatch({
          type: 'INVITE_DEVICE',
          payload: { invitation: invitation as never },
        })
      }

      expect(inviteAMember(undefined)).toThrowError(/has to carry an invitation/i)
      expect(inviteAMember(null)).toThrowError(/has to carry an invitation/i)
      expect(Object.keys(alice.team.state.invitations)).toHaveLength(0)

      expect(inviteADevice(undefined)).toThrowError(/has to carry an invitation/i)
      expect(inviteADevice(null)).toThrowError(/has to carry an invitation/i)
      expect(Object.keys(bob.team.state.invitations)).toHaveLength(0)

      // ✅ A real invitation still gets posted
      alice.team.inviteMember()
      expect(Object.keys(alice.team.state.invitations)).toHaveLength(1)
    })

    it("won't accept a member admission with no userName on it", () => {
      const { alice, bob, eve } = setup(
        'alice',
        { user: 'bob', member: false },
        { user: 'eve', admin: false }
      )

      // 👩🏾 Alice invites 👨🏻‍🦲 Bob, and 👨🏻‍🦲 Bob generates a real proof
      const { seed, id } = alice.team.inviteMember()
      const bobsProof = generateProof(seed, bob.user.keys)

      // 🦹‍♀️ Eve relays the admission, but leaves the userName off the payload. Nothing about the
      // graph fills it in, and `uniqueUserNameAndId` calls `toLowerCase()` on it.
      eve.team = teams.load(alice.team.save(), eve.localContext, alice.team.teamKeys())
      const admitBobWithNoUserName = (userName: unknown) => () => {
        eve.team.dispatch({
          type: 'ADMIT_MEMBER',
          payload: {
            id,
            userName: userName as string,
            memberKeys: redactKeys(bob.user.keys),
            proof: bobsProof,
            lockboxes: [],
          },
        })
      }

      expect(admitBobWithNoUserName(undefined)).toThrowError(/needs a usable userName/)
      expect(admitBobWithNoUserName(null)).toThrowError(/needs a usable userName/)
      expect(admitBobWithNoUserName('')).toThrowError(/needs a usable userName/)
      expect(eve.team.has(bob.userId)).toBe(false)

      // ✅ The same admission with a userName on it still goes through
      eve.team.admitMember(bobsProof, redactKeys(bob.user.keys), bob.userName)
      expect(eve.team.has(bob.userId)).toBe(true)
    })

    it("won't accept an admission with no keys on it", () => {
      const { alice, bob } = setup('alice', { user: 'bob', member: false })
      const alicePhone = redactDevice(alice.phone!)

      // `admissionMustBeProven` takes the identity being admitted off the keyset the payload
      // carries, and fingerprints that keyset to compare with the proof
      const { seed: memberSeed, id: memberId } = alice.team.inviteMember()
      const admitAMemberWithNoKeys = () => {
        alice.team.dispatch({
          type: 'ADMIT_MEMBER',
          payload: {
            id: memberId,
            userName: bob.userName,
            memberKeys: null as unknown as Keyset,
            proof: generateProof(memberSeed, bob.user.keys),
            lockboxes: [],
          },
        })
      }

      expect(admitAMemberWithNoKeys).toThrowError(/has to carry the member's keys/i)
      expect(alice.team.has(bob.userId)).toBe(false)

      const { seed: deviceSeed, id: deviceId } = alice.team.inviteDevice()
      const admitADeviceWithNoDevice = (device: unknown) => () => {
        alice.team.dispatch({
          type: 'ADMIT_DEVICE',
          payload: {
            id: deviceId,
            device: device as Device,
            proof: generateProof(deviceSeed, alicePhone.keys),
          },
        })
      }

      expect(admitADeviceWithNoDevice(null)).toThrowError(/has to carry a device/i)
      expect(admitADeviceWithNoDevice({ ...alicePhone, keys: null })).toThrowError(
        /has to carry the device's keys/i
      )
      expect(alice.team.members(alice.userId).devices).toHaveLength(1)

      // ✅ The real device, with its own keys, still gets admitted
      alice.team.admitDevice(generateProof(deviceSeed, alicePhone.keys), alicePhone)
      expect(alice.team.members(alice.userId).devices).toHaveLength(2)
    })

    it("won't accept an admission naming an invitation the team doesn't have", () => {
      const { alice, bob } = setup('alice', { user: 'bob', member: false })

      // `select.getInvitation` asserts when the id names nothing, which would come out of the
      // validator as a bare Error rather than a refusal
      const { seed } = alice.team.inviteMember()
      const admitOnAnInvitationNobodyPosted = () => {
        alice.team.dispatch({
          type: 'ADMIT_MEMBER',
          payload: {
            id: 'no-such-invitation' as Base58,
            userName: bob.userName,
            memberKeys: redactKeys(bob.user.keys),
            proof: generateProof(seed, bob.user.keys),
            lockboxes: [],
          },
        })
      }

      expect(admitOnAnInvitationNobodyPosted).toThrowError(/invitation.*the team doesn't have/i)
      expect(alice.team.has(bob.userId)).toBe(false)

      // ✅ The invitation that WAS posted still admits him
      alice.team.admitMember(generateProof(seed, bob.user.keys), bob.user.keys, bob.userName)
      expect(alice.team.has(bob.userId)).toBe(true)
    })

    it("won't accept a REMOVE_DEVICE link naming no device on the team", () => {
      const { bob } = setup('alice', { user: 'bob', admin: false })

      // `canOnlyRemoveYourOwnDevices` looks the device up to see whose it is, and the transform
      // that applies the removal looks it up again — `select.device` asserts rather than answering,
      // so an id naming nothing threw a bare Error out of a replay instead of being refused
      const removeADeviceThatIsntThere = () => {
        bob.team.dispatch({ type: 'REMOVE_DEVICE', payload: { deviceId: 'no-such-device' } })
      }

      expect(removeADeviceThatIsntThere).toThrowError(/isn't on the team/i)
      expect(bob.team.members(bob.userId).devices).toHaveLength(1)

      // ✅ His own device is still his to remove
      bob.team.removeDevice(bob.device.deviceId)
      expect(bob.team.members(bob.userId).devices).toHaveLength(0)
    })
  })
})
