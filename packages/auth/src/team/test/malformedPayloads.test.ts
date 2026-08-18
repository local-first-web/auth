import { createKeyset, redactKeys, type Base58, type Keyset, type Store } from '@localfirst/crdx'
import { redactDevice, type Device } from 'index.js'
import {
  create as createInvitation,
  generateProof,
  type MemberInvitation,
} from 'invitation/index.js'
import * as teams from 'team/index.js'
import { redactUser } from 'team/redactUser.js'
import { type Member, type TeamAction, type TeamContext, type TeamState } from 'team/types.js'
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
      const brokenVariants = ({ type, payload, required, arrays }: ShapeCase) => {
        const variants: Array<[string, unknown]> = [
          [`${type} payload=null`, { type, payload: null }],
        ]
        for (const field of required) {
          variants.push(
            [`${type} ${field}=null`, { type, payload: setPath(payload, field, null) }],
            [`${type} ${field}=undefined`, { type, payload: setPath(payload, field, undefined) }]
          )
        }

        // An array field left off is legitimate — that's what every honest link that carries no
        // lockboxes looks like. Only a value that isn't an array is refused.
        for (const field of arrays) {
          variants.push([`${type} ${field}=null`, { type, payload: setPath(payload, field, null) }])
        }

        return variants
      }

      it('refuses every one of them before anything reaches the graph', () => {
        const { alice, bob, cases } = everyCase()

        expect(cases.map(c => c.type).sort()).toEqual([...everyActionType].sort())

        const outcomes = cases.flatMap(brokenVariants).map(([label, action]) => {
          try {
            alice.team.dispatch(action as TeamAction)
            return `${label}: ACCEPTED`
          } catch (error) {
            const { message } = error as Error
            const refused = /has to carry|needs a usable/.test(message)
            return refused ? `${label}: refused` : `${label}: THREW ${message}`
          }
        })

        // Every one of them refused, and none of them by a TypeError
        expect(outcomes.filter(outcome => !outcome.endsWith('refused'))).toEqual([])
        expect(outcomes).toHaveLength(125)

        // ...and because they were refused before being appended, the graph is exactly as it was:
        // 👩🏾 Alice can still reload it, and 👨🏻‍🦲 Bob can still merge it
        const reloaded = teams.load(alice.team.save(), alice.localContext, alice.team.teamKeyring())
        expect(reloaded.members()).toHaveLength(2)
        bob.team.merge(alice.team.graph)
        expect(bob.team.members()).toHaveLength(2)
      })

      it('refuses every one of them on replay, too', () => {
        const { alice, cases } = everyCase()

        // `Team.dispatch` refuses these before the store ever sees them, which is what keeps them
        // off the graph — so going through it can't tell us what a peer replaying the chain would
        // do. This goes around it, straight to the store, which appends and then reduces: the same
        // path a link takes when it arrives from someone else.
        const { store } = alice.team as unknown as {
          store: Store<TeamState, TeamAction, TeamContext>
        }
        const teamKeys = alice.team.teamKeys()

        const outcomes = cases.flatMap(brokenVariants).map(([label, action]) => {
          try {
            store.dispatch(action as TeamAction, teamKeys)
            return `${label}: ACCEPTED`
          } catch (error) {
            const { message } = error as Error
            const refused = /has to carry|needs a usable/.test(message)
            return refused ? `${label}: refused` : `${label}: THREW ${message}`
          }
        })

        expect(outcomes.filter(outcome => !outcome.endsWith('refused'))).toEqual([])

        // This team's graph is now full of links that don't replay, which is exactly why
        // `Team.dispatch` doesn't let them get this far (see auth-bs2)
      })
    })
  })
})
