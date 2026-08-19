import { createKeyset, redactKeys, type Base58, type Keyset, type Store } from '@localfirst/crdx'
import { redactDevice, type Device } from 'index.js'
import {
  create as createInvitation,
  generateProof,
  type MemberInvitation,
} from 'invitation/index.js'
import { type Lockbox } from 'lockbox/index.js'
import { getTeamState } from 'team/getTeamState.js'
import * as teams from 'team/index.js'
import { redactUser } from 'team/redactUser.js'
import {
  type Member,
  type TeamAction,
  type TeamContext,
  type TeamGraph,
  type TeamState,
} from 'team/types.js'
import { KeyType } from 'util/index.js'
import { setup, type UserStuff } from 'util/testing/index.js'
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

/** Every action type there is. `checkPayload.ts` is exhaustive over these; this is how we notice
 * if one of them never made it into the table below. */
const everyActionType = [
  'ROOT',
  'ADD_MEMBER',
  'ADD_DEVICE',
  'ADD_ROLE',
  'ADD_MEMBER_ROLE',
  'REMOVE_MEMBER',
  'REMOVE_DEVICE',
  'REMOVE_ROLE',
  'REMOVE_MEMBER_ROLE',
  'INVITE_MEMBER',
  'INVITE_DEVICE',
  'REVOKE_INVITATION',
  'ADMIT_MEMBER',
  'ADMIT_DEVICE',
  'CHANGE_MEMBER_KEYS',
  'ROTATE_KEYS',
  'ADD_SERVER',
  'REMOVE_SERVER',
  'MESSAGE',
  'SET_TEAM_NAME',
] as const

/** A copy of `payload` with the field at `path` (e.g. `member.keys`) set to `value` */
const setPath = (payload: any, path: string, value: unknown): any => {
  const [field, ...rest] = path.split('.')
  return {
    ...payload,
    [field]: rest.length === 0 ? value : setPath(payload[field] ?? {}, rest.join('.'), value),
  }
}

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

      expect(addDevice({ ...bobsPhone, deviceId: '' })).toThrowError(/not a usable deviceId/)
      expect(addDevice({ ...bobsPhone, userId: null as unknown as string })).toThrowError(
        /not a usable userId/
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

    /**
     * These three are the paths that a check during reduction can't cover, which is why the check
     * is at the door instead: a link the resolver discards is handed to `invalidLinkReducer`
     * INSTEAD of to the validators, the resolver itself walks payloads before anything has
     * validated them, and a lockbox element outlives the link that carried it.
     */
    describe('arriving in a concurrency bubble', () => {
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

      it("won't merge a graph whose malformed link is one the resolver discards", () => {
        const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

        // An admission with no keys on it. Nothing 👩🏾 Alice runs will validate this link, because
        // 👨🏻‍🦲 Bob is about to be removed concurrently — so the resolver discards it, and the
        // reducer hands it to `invalidLinkReducer`, which reads `payload.memberKeys.name`.
        const { seed, id } = bob.team.inviteMember()
        bobAuthorsDirectly(bob, {
          type: 'ADMIT_MEMBER',
          payload: {
            id,
            userName: charlie.userName,
            memberKeys: null,
            proof: generateProof(seed, charlie.user.keys),
            lockboxes: [],
          },
        })

        alice.team.remove(bob.userId)

        expect(() => alice.team.merge(bob.team.graph)).toThrowError(/can't be replayed/i)

        // ✅ Her own graph is untouched, so she can still reload it
        expect(alice.team.has(charlie.userId)).toBe(false)
        const reloaded = teams.load(alice.team.save(), alice.localContext, alice.team.teamKeyring())
        expect(reloaded.members()).toHaveLength(1)
      })

      it("won't merge a graph whose malformed link the resolver has to walk", () => {
        const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

        // 👨🏻‍🦲 Bob invites and admits 👳🏽‍♂️ Charlie for real, so the bubble has an ADMIT link in
        // it, and then posts an INVITE carrying no invitation. When his links are discarded,
        // `findDependentLinks` looks for admissions that used that invitation — reading `.id` off
        // the nothing it carries.
        const { seed } = bob.team.inviteMember()
        bob.team.admitMember(
          generateProof(seed, charlie.user.keys),
          charlie.user.keys,
          charlie.userName
        )
        bobAuthorsDirectly(bob, { type: 'INVITE_MEMBER', payload: { invitation: null } })

        alice.team.remove(bob.userId)

        expect(() => alice.team.merge(bob.team.graph)).toThrowError(/can't be replayed/i)

        const reloaded = teams.load(alice.team.save(), alice.localContext, alice.team.teamKeyring())
        expect(reloaded.members()).toHaveLength(1)
        expect(Object.keys(reloaded.state.invitations)).toHaveLength(0)
      })

      it("won't accept a link with nothing on it at all", () => {
        const { alice, bob } = setup('alice', 'bob')

        // The guard reads the action off the link before it reads the payload off the action, so
        // it has to allow for there being no action either — otherwise the one thing that must
        // never throw is the thing that throws.
        // A link 👨🏻‍🦲 Bob doesn't have yet, so it's one his door actually looks at
        alice.team.dispatch({ type: 'MESSAGE', payload: { message: 'hello' } })
        const cleanGraph = alice.team.graph
        const [newest] = cleanGraph.head
        const theirGraph = {
          ...cleanGraph,
          links: { ...cleanGraph.links, [newest]: { ...cleanGraph.links[newest], body: null } },
        } as unknown as TeamGraph

        expect(() => bob.team.merge(theirGraph)).toThrowError(/has to carry an action/i)

        // ✅ Bob's graph is untouched, and a graph with links on it still merges
        expect(bob.team.members()).toHaveLength(2)
        bob.team.merge(cleanGraph)
        expect(bob.team.members()).toHaveLength(2)
      })

      it("won't read team state out of a graph carrying one either", () => {
        const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

        // The same admission with no keys on it, this time reaching the door that an INVITEE comes
        // through: `getTeamState` deserializes the graph the admitter sends with ACCEPT_INVITATION
        // and runs the same resolver and reducer over it — `getDeviceUserFromGraph` and the
        // `joinedTheRightTeam` guard both land here, and crdx's own `validate` result is discarded
        // below this, so there's nothing else between the graph and the dereference.
        const { seed, id } = bob.team.inviteMember()
        bobAuthorsDirectly(bob, {
          type: 'ADMIT_MEMBER',
          payload: {
            id,
            userName: charlie.userName,
            memberKeys: null,
            proof: generateProof(seed, charlie.user.keys),
            lockboxes: [],
          },
        })
        alice.team.remove(bob.userId)
        bobAuthorsDirectly(bob, { type: 'MESSAGE', payload: { message: 'hello' } })

        const theirGraph = bob.team.save()
        const keyring = bob.team.teamKeyring()

        expect(() => getTeamState(theirGraph, keyring)).toThrowError(/can't be replayed/i)

        // ✅ The same blob is refused the same way by every other door
        expect(() => teams.load(theirGraph, charlie.localContext, keyring)).toThrowError(
          /can't be replayed/i
        )
      })

      it("won't accept a member whose devices nothing after them could read", () => {
        const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

        // A member arrives carrying their devices. Nothing reads them on the way in, and once
        // they're on the team nothing checks them again: `addDevice` reads `member.devices` with
        // `= []` and `getDevice` with `?? []`, and neither of those catches `null`. So the throw
        // wouldn't land here — it would land on the next ordinary ADD_DEVICE for 👳🏽‍♂️ Charlie,
        // for everyone, for good.
        bobAuthorsDirectly(bob, {
          type: 'ADD_MEMBER',
          payload: { member: { ...redactUser(charlie.user), devices: null }, roles: [] },
        })

        expect(() => alice.team.merge(bob.team.graph)).toThrowError(/can't be replayed/i)
        expect(alice.team.has(charlie.userId)).toBe(false)

        // ✅ 👳🏽‍♂️ Charlie joins the ordinary way, and his device goes on afterwards
        alice.team.addForTesting(charlie.user, [], redactDevice(charlie.device))
        alice.team.dispatch({
          type: 'ADD_DEVICE',
          payload: { device: redactDevice(charlie.phone!) },
        })
        expect(alice.team.members(charlie.userId).devices).toHaveLength(2)
      })

      it("won't accept a lockbox that nothing after it could read", () => {
        const { alice, bob } = setup('alice', { user: 'bob', admin: false })

        // Removing your own device is open to every member, and the transform reads the lockboxes
        // to find the one addressed to it. A lockbox is also collected into `state.lockboxes`,
        // where every LATER link's rules destructure it — so one of these outlives its own link.
        const removeHisOwnDevice = () => {
          bob.team.dispatch({
            type: 'REMOVE_DEVICE',
            payload: { deviceId: bob.device.deviceId, lockboxes: [null] as unknown as Lockbox[] },
          })
        }

        expect(removeHisOwnDevice).toThrowError(/lockbox 0 is not a lockbox/i)
        expect(bob.team.members(bob.userId).devices).toHaveLength(1)

        // ...and the same link arriving from him is refused at 👩🏾 Alice's door
        bobAuthorsDirectly(bob, {
          type: 'REMOVE_DEVICE',
          payload: { deviceId: bob.device.deviceId, lockboxes: [{}] },
        })
        expect(() => alice.team.merge(bob.team.graph)).toThrowError(/can't be replayed/i)

        // ✅ Both graphs are as they were
        const reloaded = teams.load(alice.team.save(), alice.localContext, alice.team.teamKeyring())
        expect(reloaded.members()).toHaveLength(2)
      })
    })

    /**
     * The rest of this file is about particular fields; this is about the rule being total.
     *
     * Every action type is here, with every field anything downstream dereferences. Each one is
     * tried both ways nothing arrives — left off, and explicitly `null` — and the arrays are tried
     * as `null` too, since every default in the codebase is `= []` and that only catches the first
     * spelling. A type missing from this table is caught by the compiler in `checkPayload.ts`,
     * where the switch is exhaustive over `TeamAction`; a type missing from BOTH is caught by the
     * list of expected types below.
     */
    describe('the payload rule is total', () => {
      type ShapeCase = {
        type: TeamAction['type']
        /** A payload with everything on it. It doesn't have to be one the team would accept —
         * nothing here is ever dispatched intact, only in the broken variants below. */
        payload: Record<string, unknown>
        /** Fields something downstream dereferences, or identifiers the team is indexed by */
        required: string[]
        /** Fields that may be left off, but can't be anything but an array if they're there */
        arrays: string[]
      }

      const everyCase = (): { alice: UserStuff; bob: UserStuff; cases: ShapeCase[] } => {
        const { alice, bob } = setup('alice', 'bob')

        const member = redactUser(bob.user)
        const device = redactDevice(bob.phone!)
        const keys = redactKeys(createKeyset({ type: USER, name: bob.userId }))
        const server = {
          host: 'example.com',
          keys: redactKeys(createKeyset({ type: KeyType.SERVER, name: 'example.com' })),
        }
        const invitation = createInvitation({ kind: 'MEMBER', seed: 'passw0rd' })
        const deviceInvitation = createInvitation({
          kind: 'DEVICE',
          seed: 'passw0rd',
          userId: bob.userId,
        })
        const proof = generateProof('passw0rd', bob.user.keys)
        const lockboxes: never[] = []

        const cases: ShapeCase[] = [
          {
            type: 'ROOT',
            payload: { name: 'Team', rootMember: member, rootDevice: device, lockboxes },
            required: [
              'rootMember',
              'rootMember.keys',
              'rootMember.userId',
              'rootMember.userName',
              'rootDevice',
              'rootDevice.keys',
              'rootDevice.deviceId',
              'rootDevice.userId',
            ],
            arrays: ['lockboxes'],
          },
          {
            type: 'ADD_MEMBER',
            payload: { member, roles: [], lockboxes },
            required: ['member', 'member.keys', 'member.userId', 'member.userName'],
            arrays: ['roles', 'lockboxes'],
          },
          {
            type: 'ADD_DEVICE',
            payload: { device, lockboxes },
            required: ['device', 'device.keys', 'device.deviceId', 'device.userId'],
            arrays: ['lockboxes'],
          },
          {
            type: 'ADD_ROLE',
            payload: { roleName: 'MANAGERS', lockboxes },
            required: ['roleName'],
            arrays: ['lockboxes'],
          },
          {
            type: 'ADD_MEMBER_ROLE',
            payload: { userId: bob.userId, roleName: 'MANAGERS', lockboxes },
            required: ['userId', 'roleName'],
            arrays: ['lockboxes'],
          },
          {
            type: 'REMOVE_MEMBER_ROLE',
            payload: { userId: bob.userId, roleName: 'MANAGERS', lockboxes },
            required: ['userId', 'roleName'],
            arrays: ['lockboxes'],
          },
          {
            type: 'REMOVE_MEMBER',
            payload: { userId: bob.userId, lockboxes },
            required: ['userId'],
            arrays: ['lockboxes'],
          },
          {
            type: 'ROTATE_KEYS',
            payload: { userId: bob.userId, lockboxes },
            required: ['userId'],
            arrays: ['lockboxes'],
          },
          {
            type: 'REMOVE_DEVICE',
            payload: { deviceId: bob.device.deviceId, lockboxes },
            required: ['deviceId'],
            arrays: ['lockboxes'],
          },
          {
            type: 'REMOVE_ROLE',
            payload: { roleName: 'MANAGERS', lockboxes },
            required: ['roleName'],
            arrays: ['lockboxes'],
          },
          {
            type: 'INVITE_MEMBER',
            payload: { invitation, lockboxes },
            required: ['invitation', 'invitation.id'],
            arrays: ['lockboxes'],
          },
          {
            type: 'INVITE_DEVICE',
            payload: { invitation: deviceInvitation, lockboxes },
            required: ['invitation', 'invitation.id'],
            arrays: ['lockboxes'],
          },
          {
            type: 'REVOKE_INVITATION',
            payload: { id: invitation.id, lockboxes },
            required: ['id'],
            arrays: ['lockboxes'],
          },
          {
            type: 'ADMIT_MEMBER',
            payload: {
              id: invitation.id,
              userName: bob.userName,
              memberKeys: redactKeys(bob.user.keys),
              proof,
              lockboxes,
            },
            // `memberKeys.name` is `admissionMustBeProven`'s: it binds the identity being admitted
            // to the proof of invitation, and it does so before the reducer reads it
            required: ['id', 'memberKeys', 'userName'],
            arrays: ['lockboxes'],
          },
          {
            type: 'ADMIT_DEVICE',
            payload: { id: deviceInvitation.id, device, proof, lockboxes },
            // Likewise `device.deviceId` and `device.userId`
            required: ['id', 'device', 'device.keys'],
            arrays: ['lockboxes'],
          },
          {
            type: 'CHANGE_MEMBER_KEYS',
            payload: { keys, lockboxes },
            required: ['keys', 'keys.name'],
            arrays: ['lockboxes'],
          },
          {
            type: 'ADD_SERVER',
            payload: { server, lockboxes },
            required: ['server', 'server.keys', 'server.host'],
            arrays: ['lockboxes'],
          },
          {
            type: 'REMOVE_SERVER',
            payload: { host: server.host, lockboxes },
            required: ['host'],
            arrays: ['lockboxes'],
          },
          // Nothing takes these apart: the message and the team name are stored as they arrive
          {
            type: 'MESSAGE',
            payload: { message: 'hello', lockboxes },
            required: [],
            arrays: ['lockboxes'],
          },
          {
            type: 'SET_TEAM_NAME',
            payload: { teamName: 'Team', lockboxes },
            required: [],
            arrays: ['lockboxes'],
          },
        ]

        return { alice, bob, cases }
      }

      /** Every variant of a case that has to be refused, as `[label, action]` */
      const brokenVariants = (
        { type, payload, required, arrays }: ShapeCase,
        aRealLockbox: Lockbox
      ) => {
        const variants: Array<[string, unknown]> = [
          [`${type} payload=null`, { type, payload: null }],
          [`${type} payload=undefined`, { type, payload: undefined }],
        ]

        for (const field of required) {
          variants.push(
            [`${type} ${field}=null`, { type, payload: setPath(payload, field, null) }],
            [`${type} ${field}=undefined`, { type, payload: setPath(payload, field, undefined) }]
          )
        }

        // An array field left off is legitimate — that's what every honest link carrying no
        // lockboxes looks like. Anything that isn't an array is not.
        for (const field of arrays) {
          variants.push([`${type} ${field}=null`, { type, payload: setPath(payload, field, null) }])
        }

        // Being an array isn't enough: the ELEMENTS are what `collectLockboxes` puts into
        // `state.lockboxes`, where every later link's rules destructure them
        const elements: Array<[string, unknown]> = [
          ['[null]', [null]],
          ['[undefined]', [undefined]],
          ['[{}]', [{}]],
          ['[lockbox with no recipient]', [{ ...aRealLockbox, recipient: null }]],
          [
            '[lockbox holding something other than bytes]',
            [{ ...aRealLockbox, encryptedPayload: 'not-bytes' }],
          ],
        ]
        for (const [label, value] of elements) {
          variants.push([
            `${type} lockboxes=${label}`,
            { type, payload: setPath(payload, 'lockboxes', value) },
          ])
        }

        if (type === 'ADD_MEMBER') {
          variants.push(
            [`${type} roles=[null]`, { type, payload: setPath(payload, 'roles', [null]) }],
            [`${type} roles=['']`, { type, payload: setPath(payload, 'roles', ['']) }]
          )
        }

        // A member arrives carrying their devices, and nothing looks at them again once they're on
        // the team — so a bad one lands on the NEXT link that touches that member, not on this one.
        // (`devices` left off entirely is what every honest link looks like, so that one is
        // legitimate rather than refused.)
        const memberField = type === 'ROOT' ? 'rootMember' : type === 'ADD_MEMBER' ? 'member' : ''
        if (memberField !== '') {
          variants.push(
            [
              `${type} ${memberField}.devices=null`,
              { type, payload: setPath(payload, `${memberField}.devices`, null) },
            ],
            [
              `${type} ${memberField}.devices=[null]`,
              { type, payload: setPath(payload, `${memberField}.devices`, [null]) },
            ],
            [
              `${type} ${memberField}.devices=[device with no keys]`,
              {
                type,
                payload: setPath(payload, `${memberField}.devices`, [
                  { deviceId: 'd', userId: 'u' },
                ]),
              },
            ]
          )
        }

        return variants
      }

      /** What each attempt did, as a line we can read in a diff */
      const outcome = (label: string, attempt: () => void) => {
        try {
          attempt()
          return `${label}: ACCEPTED`
        } catch (error) {
          const { message } = error as Error
          const refused = /has to carry|needs a usable|can't be replayed/.test(message)
          return refused ? `${label}: refused` : `${label}: THREW ${message}`
        }
      }

      it('refuses every one of them before anything reaches the graph', () => {
        const { alice, bob, cases } = everyCase()
        const [aRealLockbox] = alice.team.state.lockboxes

        expect(cases.map(c => c.type).sort()).toEqual([...everyActionType].sort())

        const outcomes = cases
          .flatMap(shapeCase => brokenVariants(shapeCase, aRealLockbox))
          .map(([label, action]) =>
            outcome(label, () => {
              alice.team.dispatch(action as TeamAction)
            })
          )

        // Every one of them refused, and none of them by a TypeError
        expect(outcomes.filter(result => !result.endsWith('refused'))).toEqual([])
        expect(outcomes).toHaveLength(253)

        // ...and because they were refused before being appended, the graph is exactly as it was:
        // 👩🏾 Alice can still reload it, and 👨🏻‍🦲 Bob can still merge it
        const reloaded = teams.load(alice.team.save(), alice.localContext, alice.team.teamKeyring())
        expect(reloaded.members()).toHaveLength(2)
        bob.team.merge(alice.team.graph)
        expect(bob.team.members()).toHaveLength(2)
      })

      it('refuses every one of them when they arrive from a peer', () => {
        const { alice, bob, cases } = everyCase()
        const [aRealLockbox] = alice.team.state.lockboxes

        // Going through `Team.dispatch` can't tell us what happens when a link like this arrives
        // from someone else, because it refuses them before the store ever sees them. So 👨🏻‍🦲 Bob
        // goes around it, straight to his store, which appends and then reduces — and each link he
        // manages to get onto his graph that way is handed to 👩🏾 Alice the way a peer's would be.
        const { store } = bob.team as unknown as {
          store: Store<TeamState, TeamAction, TeamContext>
        }
        const teamKeys = bob.team.teamKeys()
        const cleanGraph = alice.team.graph

        const onReplay: string[] = []
        const onArrival: string[] = []

        for (const [label, action] of cases.flatMap(c => brokenVariants(c, aRealLockbox))) {
          // What a peer replaying the chain says about it — the on-chain backstop
          onReplay.push(
            outcome(label, () => {
              store.dispatch(action as TeamAction, teamKeys)
            })
          )

          // The link is on Bob's graph now, refused or not. This is that link, arriving.
          const [head] = store.getGraph().head
          const theirGraph = {
            ...cleanGraph,
            links: { ...cleanGraph.links, [head]: store.getGraph().links[head] },
          }
          onArrival.push(
            outcome(label, () => {
              alice.team.merge(theirGraph)
            })
          )
        }

        expect(onReplay.filter(result => !result.endsWith('refused'))).toEqual([])
        expect(onArrival.filter(result => !result.endsWith('refused'))).toEqual([])

        // 👩🏾 Alice refused every one of them at the door, so her graph is untouched — she can
        // still reload it, and still merge a graph that doesn't carry one of these
        const reloaded = teams.load(alice.team.save(), alice.localContext, alice.team.teamKeyring())
        expect(reloaded.members()).toHaveLength(2)
        alice.team.merge(cleanGraph)
        expect(alice.team.members()).toHaveLength(2)
      })
    })
  })
})
