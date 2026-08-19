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
        /has to carry a device it can use: it has no keys/i
      )

      // An admission is the fourth place a device arrives, and it used to be the one that settled
      // for `keys` merely being there. `admissionMustBeProven` fingerprints whatever it finds, and
      // `redactKeys` reads `.hasOwnProperty` off `encryption` and `signature` — so a keyset that
      // is a string, or an object with no keys in it, was a TypeError rather than a refusal, on a
      // link that was already on the graph. The same payload through ADD_DEVICE was refused, which
      // is what made this a gap rather than a decision.
      expect(admitADeviceWithNoDevice({ ...alicePhone, keys: 'nope' })).toThrowError(
        /has to carry a device it can use: it has no keys/i
      )
      expect(admitADeviceWithNoDevice({ ...alicePhone, keys: {} })).toThrowError(
        /has to carry a device it can use: it has no keys/i
      )
      expect(alice.team.members(alice.userId).devices).toHaveLength(1)

      // ...and her graph is untouched by any of them, so it still reloads
      expect(
        teams.load(alice.team.save(), alice.localContext, alice.team.teamKeyring()).members()
      ).toHaveLength(1)

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

    it("won't accept a member carrying a device that isn't theirs", () => {
      const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })
      const ghost = {
        deviceId: 'ghost',
        userId: 'nobody',
        keys: redactKeys(createKeyset({ type: KeyType.DEVICE, name: 'ghost' })),
      }

      // Every field on this device is fine; what's wrong is whose it says it is. A device carried
      // on a member is filed under that member and never looked at again, so `removeDevice` — which
      // resolves a device's owner among the members and asserts when it finds nobody — is where it
      // lands, on a LATER link, for everybody. `rootDeviceBelongsToRootUser` says exactly this about
      // the founding device; nothing said it about the devices a member arrives with.
      const addCharlieWithAGhostDevice = () => {
        alice.team.dispatch({
          type: 'ADD_MEMBER',
          payload: {
            member: { ...redactUser(charlie.user), devices: [ghost] } as Member,
            roles: [],
          },
        })
      }

      expect(addCharlieWithAGhostDevice).toThrowError(/it belongs to 'nobody'/i)
      expect(alice.team.has(charlie.userId)).toBe(false)

      // ...and the same link arriving from 👨🏻‍🦲 Bob is refused at her door
      bobAuthorsDirectly(bob, {
        type: 'ADD_MEMBER',
        payload: { member: { ...redactUser(charlie.user), devices: [ghost] }, roles: [] },
      })
      expect(() => alice.team.merge(bob.team.graph)).toThrowError(/can't be replayed/i)
      expect(alice.team.has(charlie.userId)).toBe(false)

      // ✅ Her graph still reloads, and 👳🏽‍♂️ Charlie still joins carrying his OWN device
      const reloaded = teams.load(alice.team.save(), alice.localContext, alice.team.teamKeyring())
      expect(reloaded.members()).toHaveLength(2)
      alice.team.addForTesting(charlie.user, [], redactDevice(charlie.device))
      expect(alice.team.members(charlie.userId).devices).toHaveLength(1)
    })

    it("won't accept an admission whose proof nothing could verify", () => {
      const { alice, bob } = setup('alice', { user: 'bob', member: false })

      // A proof is checked by everyone who replays the chain, and the last thing that check does is
      // hand `signature` to libsodium by way of `base58.decode`. Neither of them answers `false` for
      // something they can't read: `decode` throws `Expected String` or `Non-base58 character`, and
      // libsodium throws `invalid signature length` — including for '', which is perfectly good
      // base58 of nothing at all.
      const admitWithProof = (proof: unknown) => () => {
        const { seed, id } = alice.team.inviteMember()
        const realProof = generateProof(seed, bob.user.keys)
        alice.team.dispatch({
          type: 'ADMIT_MEMBER',
          payload: {
            id,
            userName: bob.userName,
            memberKeys: redactKeys(bob.user.keys),
            proof: (typeof proof === 'object' && proof !== null
              ? { ...realProof, ...proof }
              : proof) as never,
            lockboxes: [],
          },
        })
      }

      expect(admitWithProof(null)).toThrowError(/a proof it can check: there isn't one/i)
      expect(admitWithProof(123)).toThrowError(/a proof it can check: there isn't one/i)
      for (const signature of [null, 123, 'not-base58!!!', '', 'zzz']) {
        expect(admitWithProof({ signature })).toThrowError(/is not a usable signature/i)
      }

      expect(alice.team.has(bob.userId)).toBe(false)

      // ✅ A real proof still admits him
      const { seed, id } = alice.team.inviteMember()
      alice.team.dispatch({
        type: 'ADMIT_MEMBER',
        payload: {
          id,
          userName: bob.userName,
          memberKeys: redactKeys(bob.user.keys),
          proof: generateProof(seed, bob.user.keys),
          lockboxes: [],
        },
      })
      expect(alice.team.has(bob.userId)).toBe(true)
    })

    it("won't post an invitation nobody could ever admit on", () => {
      const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

      // This is the one that doesn't look like a malformed payload at all. An invitation is only
      // recorded on the way in — nothing reads its public key until somebody presents a proof
      // against it — so a key libsodium can't take was accepted here, merged by every peer, and sat
      // on the graph until the first admission named it. At that point it's not one peer's problem;
      // it's everyone's, including the peers who took the invitation link happily.
      const postAnInvitation = (publicKey: unknown) => () => {
        const invitation = createInvitation({ kind: 'MEMBER', seed: 'passw0rd' })
        alice.team.dispatch({
          type: 'INVITE_MEMBER',
          payload: { invitation: { ...invitation, publicKey } as never },
        })
      }

      for (const publicKey of [null, undefined, 123, '', 'not-base58!!!', 'zzz']) {
        expect(postAnInvitation(publicKey)).toThrowError(/needs a usable invitation public key/i)
      }

      expect(Object.keys(alice.team.state.invitations)).toHaveLength(0)

      // ...and the same link arriving from 👨🏻‍🦲 Bob is refused at her door, rather than merging
      // cleanly and detonating later
      const bobsInvitation = createInvitation({ kind: 'MEMBER', seed: 'passw0rd' })
      const { publicKey: _publicKey, ...withNoPublicKey } = bobsInvitation
      bobAuthorsDirectly(bob, {
        type: 'INVITE_MEMBER',
        payload: { invitation: withNoPublicKey },
      })
      expect(() => alice.team.merge(bob.team.graph)).toThrowError(/can't be replayed/i)

      // ✅ Her graph still reloads, and a real invitation still admits 👳🏽‍♂️ Charlie
      const reloaded = teams.load(alice.team.save(), alice.localContext, alice.team.teamKeyring())
      expect(reloaded.members()).toHaveLength(2)
      const { seed, id } = alice.team.inviteMember()
      alice.team.admitMember(
        generateProof(seed, charlie.user.keys),
        redactKeys(charlie.user.keys),
        charlie.userName
      )
      expect(alice.team.has(charlie.userId)).toBe(true)
      expect(id).toBeDefined()
    })

    it("won't accept a lockbox whose recipient couldn't open it", () => {
      const { alice, bob } = setup('alice', 'bob')

      // Lockbox manifests are plaintext on the graph, so anyone can copy a real lockbox and change
      // the one field nobody reads on the way in. `encryptionKey.publicKey` is base58 that
      // `asymmetric.decryptBytes` decodes, and only the member the lockbox is ADDRESSED to ever
      // opens it — so a poisoned key merges cleanly everywhere else and takes down exactly the
      // member it names, on load, for good.
      const aRealLockbox = alice.team.state.lockboxes.find(l => l.recipient.name === bob.userId)!
      const poisoned = (publicKey: unknown) =>
        ({
          ...aRealLockbox,
          encryptionKey: { ...aRealLockbox.encryptionKey, publicKey },
        }) as unknown as Lockbox

      const sendALockbox = (publicKey: unknown) => () => {
        alice.team.dispatch({
          type: 'MESSAGE',
          payload: { message: 'hello', lockboxes: [poisoned(publicKey)] },
        })
      }

      for (const publicKey of [null, undefined, 123, '', 'not-base58!!!', 'zzz']) {
        expect(sendALockbox(publicKey)).toThrowError(/lockbox 0 has no/i)
      }

      // ...and the same link arriving from 👨🏻‍🦲 Bob is refused at her door
      bobAuthorsDirectly(bob, {
        type: 'MESSAGE',
        payload: { message: 'hello', lockboxes: [poisoned('not-base58!!!')] },
      })
      expect(() => alice.team.merge(bob.team.graph)).toThrowError(/can't be replayed/i)

      // ✅ 👩🏾 Alice's graph is untouched — she can still reload it, and she can still send a
      // message carrying the real lockbox. (👨🏻‍🦲 Bob's own graph is not: he went around his door
      // to author that link, which is exactly the failure this rule keeps peers from inheriting.)
      const reloaded = teams.load(alice.team.save(), alice.localContext, alice.team.teamKeyring())
      expect(reloaded.members()).toHaveLength(2)
      alice.team.dispatch({
        type: 'MESSAGE',
        payload: { message: 'hello', lockboxes: [aRealLockbox] },
      })
      expect(alice.team.members()).toHaveLength(2)
    })

    it("won't accept a keyset nobody could ever count from", () => {
      const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

      // The same arithmetic, one level up. `Team.changeKeys` computes a member's next generation as
      // `oldKeys.generation + 1`, so a keyset that arrives carrying a BigInt compares fine against
      // every number the team holds and throws in that one line: the member goes on the team, the
      // graph replays and reloads, and nobody can ever re-key them. This came out of trying each
      // type a payload can carry against `generation` rather than out of reading the callers —
      // only BigInt does this, and the doc that excused the field named the danger and then filed
      // it under safe.
      const withGeneration = (generation: unknown) =>
        ({
          type: 'ADD_MEMBER',
          payload: {
            member: {
              ...redactUser(charlie.user),
              keys: { ...redactKeys(charlie.user.keys), generation },
            },
            roles: [],
            lockboxes: [],
          },
        }) as unknown as TeamAction

      for (const generation of [1n, null, undefined, '5', {}]) {
        expect(() => {
          alice.team.dispatch(withGeneration(generation))
        }).toThrowError(/is not a usable generation/i)
      }

      // ...and the same link arriving from 👨🏻‍🦲 Bob is refused at 👩🏾 Alice's door
      bobAuthorsDirectly(bob, withGeneration(1n))
      expect(() => alice.team.merge(bob.team.graph)).toThrowError(/can't be replayed/i)

      // ✅ 👳🏽‍♂️ Charlie joins with an ordinary keyset, and 👩🏾 Alice can re-key him
      alice.team.addForTesting(charlie.user, [], redactDevice(charlie.device))
      alice.team.changeKeys(createKeyset({ type: USER, name: charlie.userId }))
      expect(alice.team.members(charlie.userId).keys.generation).toBe(1)
    })

    it("won't accept a lockbox whose generation nothing could count from", () => {
      const { alice, bob, charlie } = setup('alice', { user: 'bob', admin: false }, 'charlie')

      // A generation is compared AND added to, and those aren't the same kind of safe. JavaScript
      // compares a BigInt against a number happily and refuses to add one to it — so a BigInt
      // generation isn't merely accepted, it's SELECTED: `lockboxesInScope` takes the highest
      // generation in scope, which guarantees the forged lockbox is the one handed to
      // `lockbox.rotate`, whose first act is `oldLockbox.contents.generation + 1`. The graph still
      // loads; what it can't do again is rotate keys in that scope.
      const forge = (l: Lockbox, generation: unknown) =>
        ({ ...l, contents: { ...l.contents, generation } }) as unknown as Lockbox

      const hisOwn = bob.team.state.lockboxes.find(
        l => l.contents.type === USER && l.contents.name === bob.userId
      )!
      const teamScoped = bob.team.state.lockboxes.find(l => l.contents.type === 'TEAM')!

      const addHisPhone = (lockbox: Lockbox) => () => {
        bob.team.dispatch({
          type: 'ADD_DEVICE',
          payload: { device: redactDevice(bob.phone!), lockboxes: [lockbox] },
        })
      }

      // Only a BigInt is fatal; the rest are refused because a generation is a number, not because
      // we found a throw for each of them
      for (const generation of [1n, null, undefined, '5', {}]) {
        expect(addHisPhone(forge(hisOwn, generation))).toThrowError(
          /lockbox 0 has no usable generation on its contents manifest/i
        )
      }

      // ...and the same link arriving from 👨🏻‍🦲 Bob is refused at 👩🏾 Alice's door. Aimed at the
      // TEAM scope it isn't one member's problem: `remove` rotates the team keys, so it would have
      // cost 👩🏾 Alice the ability to remove ANYONE.
      bobAuthorsDirectly(bob, {
        type: 'ADD_DEVICE',
        payload: { device: redactDevice(bob.phone!), lockboxes: [forge(teamScoped, 1n)] },
      })
      expect(() => alice.team.merge(bob.team.graph)).toThrowError(/can't be replayed/i)

      // ✅ 👩🏾 Alice can still re-key 👨🏻‍🦲 Bob and still remove 👳🏽‍♂️ Charlie
      alice.team.changeKeys(createKeyset({ type: USER, name: bob.userId }))
      alice.team.remove(charlie.userId)
      expect(alice.team.members()).toHaveLength(2)
    })

    it("won't accept a lockbox that lies about a member's keys", () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: false })
      alice.team.addRole({ roleName: 'MANAGERS' })
      bob.team.merge(alice.team.graph)

      // A manifest carries the public half of the keyset it names, and `removeDevice` treats a
      // lockbox naming a later generation than the member has as the authority on that member's
      // keys: it writes the manifest's `encryption` and `signature` straight into
      // `state.members[…].keys`. From there `createMemberLockboxes` hands the encryption key to
      // `lockbox.create`, so it's an admin GRANTING A ROLE who pays — `Non-base58 character`,
      // `invalid publicKey length`, `Expected String` or `Cannot read properties of null`,
      // depending on which value the peer picked. Removing your own device is open to every
      // member, so 👨🏻‍🦲 Bob doesn't need to be an admin to say this about himself.
      //
      // Those four are the ENCRYPTION key's — `hasSecrets` short-circuits on `keys.encryption` and
      // `lockbox.create` reads only `.encryption`, so the signature reaches neither. The signature
      // breaks something else, outside replay: `Team.verify` hands `keys.signature` straight to
      // libsodium, so `team.verify()` on anything 👨🏻‍🦲 Bob signs throws for every peer from then
      // on rather than answering — measured for all of `null`, `''`, `123`, `{}`, `1n`, `'zzz'` and
      // `'not-base58!!!'`, none of which returns `false`. Both halves are load-bearing; they just
      // break for different callers.
      const hisOwn = bob.team.state.lockboxes.find(
        l => l.contents.type === USER && l.contents.name === bob.userId
      )!
      const forged = (field: string, value: unknown) =>
        ({
          ...hisOwn,
          contents: { ...hisOwn.contents, generation: 5, [field]: value },
        }) as unknown as Lockbox

      const removeHisOwnDevice = (lockbox: Lockbox) => () => {
        bob.team.dispatch({
          type: 'REMOVE_DEVICE',
          payload: { deviceId: bob.device.deviceId, lockboxes: [lockbox] },
        })
      }

      for (const field of ['encryption', 'signature']) {
        for (const value of [null, 123, '', 'zzz', 'not-base58!!!', {}]) {
          expect(removeHisOwnDevice(forged(field, value))).toThrowError(
            new RegExp(`lockbox 0 has no usable ${field} key on its contents manifest`, 'i')
          )
        }
      }

      // ...and the same link arriving from him is refused at 👩🏾 Alice's door
      bobAuthorsDirectly(bob, {
        type: 'REMOVE_DEVICE',
        payload: { deviceId: bob.device.deviceId, lockboxes: [forged('encryption', 'zzz')] },
      })
      expect(() => alice.team.merge(bob.team.graph)).toThrowError(/can't be replayed/i)

      // ✅ 👨🏻‍🦲 Bob's keys on the team are still his own, so 👩🏾 Alice can still grant him a role
      alice.team.addMemberRole(bob.userId, 'MANAGERS')
      expect(alice.team.memberHasRole(bob.userId, 'MANAGERS')).toBe(true)
    })

    it("won't accept a lockbox nobody could ever re-key", () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: false })

      // The other manifest key a peer can pick. Re-keying a member replaces every lockbox they can
      // see, and `lockbox.rotate` hands the OLD lockbox's recipient manifest straight back to
      // `lockbox.create`, which encrypts to `manifest.publicKey` — `keyToBytes`, then libsodium.
      // Nothing on the way in reads it, so a forged one merges cleanly and loads fine, and then
      // disables the one remediation the team has for a compromised member, permanently, because
      // the lockbox is on the chain. Posting a lockbox doesn't take an admin: 👨🏻‍🦲 Bob isn't one.
      const hisOwn = bob.team.state.lockboxes.find(
        l => l.contents.type === USER && l.contents.name === bob.userId
      )!
      const forged = (publicKey: unknown) =>
        ({
          ...hisOwn,
          recipient: { ...hisOwn.recipient, publicKey },
        }) as unknown as Lockbox

      const addHisPhone = (publicKey: unknown) => () => {
        bob.team.dispatch({
          type: 'ADD_DEVICE',
          payload: { device: redactDevice(bob.phone!), lockboxes: [forged(publicKey)] },
        })
      }

      for (const publicKey of [null, undefined, 123, '', 'not-base58!!!', 'zzz']) {
        expect(addHisPhone(publicKey)).toThrowError(
          /lockbox 0 has no usable public key on its recipient manifest/i
        )
      }

      // ...and the same link arriving from him is refused at 👩🏾 Alice's door
      bobAuthorsDirectly(bob, {
        type: 'ADD_DEVICE',
        payload: { device: redactDevice(bob.phone!), lockboxes: [forged('not-base58!!!')] },
      })
      expect(() => alice.team.merge(bob.team.graph)).toThrowError(/can't be replayed/i)

      // ✅ 👩🏾 Alice can still re-key 👨🏻‍🦲 Bob, which is exactly what a forged one took away
      alice.team.changeKeys(createKeyset({ type: USER, name: bob.userId }))
      expect(alice.team.members(bob.userId).keys.generation).toBe(1)
    })

    it("won't accept a proof nothing could even look up", () => {
      const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

      // `invitation/validate` is a lodash `memoize`, and its resolver builds the cache key by
      // running `JSON.stringify` over `proof.id`, `proof.invitee` and `proof.keyHash`. That happens
      // BEFORE the memoized body, so before the `!==` that is otherwise all these three get.
      // msgpackr round-trips a BigInt as a BigInt, and `JSON.stringify` throws on one — so a proof
      // carrying one was a TypeError thrown out of validation, on every peer, forever.
      const { seed, id } = bob.team.inviteMember()
      alice.team.merge(bob.team.graph)
      const proof = generateProof(seed, charlie.user.keys)

      const admitWith = (field: string, value: unknown) => () => {
        bob.team.dispatch({
          type: 'ADMIT_MEMBER',
          payload: {
            id,
            userName: charlie.userName,
            memberKeys: redactKeys(charlie.user.keys),
            proof: setPath(proof, field, value),
            lockboxes: [],
          },
        })
      }

      expect(admitWith('id', 1n)).toThrowError(/is not a usable id/i)
      expect(admitWith('invitee', 1n)).toThrowError(/is not a usable invitee/i)
      expect(admitWith('keyHash', 1n)).toThrowError(/is not a usable keyhash/i)

      // ...and the same link arriving from 👨🏻‍🦲 Bob is refused at 👩🏾 Alice's door
      bobAuthorsDirectly(bob, {
        type: 'ADMIT_MEMBER',
        payload: {
          id,
          userName: charlie.userName,
          memberKeys: redactKeys(charlie.user.keys),
          proof: setPath(proof, 'id', 1n),
          lockboxes: [],
        },
      })
      expect(() => alice.team.merge(bob.team.graph)).toThrowError(/can't be replayed/i)

      // ✅ The honest admission still goes through
      alice.team.admitMember(proof, redactKeys(charlie.user.keys), charlie.userName)
      expect(alice.team.has(charlie.userId)).toBe(true)
    })

    it("won't merge a graph whose links map carries something that isn't a link", () => {
      const { alice, bob } = setup('alice', 'bob')

      // The guard reads a payload off every link in the graph, and a link entry is as much a peer's
      // to make up as the payload on it. A string entry was handled — `payloadProblem` allows for
      // there being no action — but `null` was dereferenced before it was checked, by the one
      // function whose whole job is not to do that.
      const graphWithEntry = (entry: unknown) =>
        ({
          ...alice.team.graph,
          links: { ...alice.team.graph.links, h: entry },
        }) as unknown as TeamGraph

      for (const entry of [null, undefined, 'nope', 123, {}, { body: null }]) {
        expect(() => bob.team.merge(graphWithEntry(entry))).toThrowError(
          /can't be replayed. this link has to carry an action/i
        )
      }

      // ✅ 👨🏻‍🦲 Bob's graph is untouched, and the same graph without the entry still merges
      expect(bob.team.members()).toHaveLength(2)
      bob.team.merge(alice.team.graph)
      expect(bob.team.members()).toHaveLength(2)
    })

    /**
     * These three are the paths that a check during reduction can't cover, which is why the check
     * is at the door instead: a link the resolver discards is handed to `invalidLinkReducer`
     * INSTEAD of to the validators, the resolver itself walks payloads before anything has
     * validated them, and a lockbox element outlives the link that carried it.
     */
    describe('arriving in a concurrency bubble', () => {
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

      it("won't merge a graph whose admission names nobody", () => {
        const { alice, bob, charlie } = setup('alice', 'bob', { user: 'charlie', member: false })

        // The identity an admission confers is the `name` on the keyset the invitee chose, and it
        // used to be left to `admissionMustBeProven` on the grounds that that rule looks at it
        // anyway. It doesn't here: 👨🏻‍🦲 Bob is removed concurrently, so the resolver discards this
        // link and the reducer hands it to `invalidLinkReducer`, which reads `memberKeys.name` and
        // files `undefined` under `removedMembers` and `pendingKeyRotations`. That merge COMMITTED
        // — and the `updated` handler then dispatched a ROTATE_KEYS naming `undefined`, which
        // every admin's own door refuses. The graph replays, so it reloads perfectly well; what it
        // can never do again is accept a link from any admin.
        const { seed, id } = bob.team.inviteMember()
        const memberKeys = { ...redactKeys(charlie.user.keys), name: undefined }
        bobAuthorsDirectly(bob, {
          type: 'ADMIT_MEMBER',
          payload: {
            id,
            userName: charlie.userName,
            memberKeys,
            proof: generateProof(seed, charlie.user.keys),
            lockboxes: [],
          },
        })

        alice.team.remove(bob.userId)

        expect(() => alice.team.merge(bob.team.graph)).toThrowError(/needs a usable userid/i)

        // ✅ Nothing was filed against a member who doesn't exist, so 👩🏾 Alice can still write to
        // her own team — and so can she after a reload, which is what used to survive
        expect(alice.team.state.pendingKeyRotations).toEqual([])
        alice.team.dispatch({ type: 'MESSAGE', payload: { message: 'hello' } })
        const reloaded = teams.load(alice.team.save(), alice.localContext, alice.team.teamKeyring())
        reloaded.dispatch({ type: 'MESSAGE', payload: { message: 'hello' } })
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
        /** Fields something runs `JSON.stringify` over before anything else looks at them, and so
         * have to be strings — msgpackr round-trips a BigInt as a BigInt, and `JSON.stringify`
         * throws on one */
        serialized: string[]
        /** Fields something does arithmetic on, and so have to be numbers — a BigInt compares
         * fine everywhere it's compared and throws in the one line that adds to it */
        numbers: string[]
        /** Fields that end up in libsodium, and so have to be base58 of a particular length —
         * being a non-empty string isn't enough for any of these */
        base58: string[]
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
            serialized: [],
            numbers: ['rootMember.keys.generation', 'rootDevice.keys.generation'],
            base58: [
              'rootMember.keys.encryption',
              'rootMember.keys.signature',
              'rootDevice.keys.encryption',
              'rootDevice.keys.signature',
            ],
          },
          {
            type: 'ADD_MEMBER',
            payload: { member, roles: [], lockboxes },
            required: ['member', 'member.keys', 'member.userId', 'member.userName'],
            arrays: ['roles', 'lockboxes'],
            serialized: [],
            numbers: ['member.keys.generation'],
            base58: ['member.keys.encryption', 'member.keys.signature'],
          },
          {
            type: 'ADD_DEVICE',
            payload: { device, lockboxes },
            required: ['device', 'device.keys', 'device.deviceId', 'device.userId'],
            arrays: ['lockboxes'],
            serialized: [],
            numbers: ['device.keys.generation'],
            base58: ['device.keys.encryption', 'device.keys.signature'],
          },
          {
            type: 'ADD_ROLE',
            payload: { roleName: 'MANAGERS', lockboxes },
            required: ['roleName'],
            arrays: ['lockboxes'],
            serialized: [],
            numbers: [],
            base58: [],
          },
          {
            type: 'ADD_MEMBER_ROLE',
            payload: { userId: bob.userId, roleName: 'MANAGERS', lockboxes },
            required: ['userId', 'roleName'],
            arrays: ['lockboxes'],
            serialized: [],
            numbers: [],
            base58: [],
          },
          {
            type: 'REMOVE_MEMBER_ROLE',
            payload: { userId: bob.userId, roleName: 'MANAGERS', lockboxes },
            required: ['userId', 'roleName'],
            arrays: ['lockboxes'],
            serialized: [],
            numbers: [],
            base58: [],
          },
          {
            type: 'REMOVE_MEMBER',
            payload: { userId: bob.userId, lockboxes },
            required: ['userId'],
            arrays: ['lockboxes'],
            serialized: [],
            numbers: [],
            base58: [],
          },
          {
            type: 'ROTATE_KEYS',
            payload: { userId: bob.userId, lockboxes },
            required: ['userId'],
            arrays: ['lockboxes'],
            serialized: [],
            numbers: [],
            base58: [],
          },
          {
            type: 'REMOVE_DEVICE',
            payload: { deviceId: bob.device.deviceId, lockboxes },
            required: ['deviceId'],
            arrays: ['lockboxes'],
            serialized: [],
            numbers: [],
            base58: [],
          },
          {
            type: 'REMOVE_ROLE',
            payload: { roleName: 'MANAGERS', lockboxes },
            required: ['roleName'],
            arrays: ['lockboxes'],
            serialized: [],
            numbers: [],
            base58: [],
          },
          {
            type: 'INVITE_MEMBER',
            payload: { invitation, lockboxes },
            required: ['invitation', 'invitation.id'],
            arrays: ['lockboxes'],
            serialized: [],
            numbers: [],
            // An invitation is only recorded on the way in; its public key isn't read until an
            // admission presents a proof against it, which is what made a bad one dormant
            base58: ['invitation.publicKey'],
          },
          {
            type: 'INVITE_DEVICE',
            payload: { invitation: deviceInvitation, lockboxes },
            required: ['invitation', 'invitation.id'],
            arrays: ['lockboxes'],
            serialized: [],
            numbers: [],
            // An invitation is only recorded on the way in; its public key isn't read until an
            // admission presents a proof against it, which is what made a bad one dormant
            base58: ['invitation.publicKey'],
          },
          {
            type: 'REVOKE_INVITATION',
            payload: { id: invitation.id, lockboxes },
            required: ['id'],
            arrays: ['lockboxes'],
            serialized: [],
            numbers: [],
            base58: [],
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
            // `memberKeys.name` is the identity being admitted, and the userId the team files them
            // under from then on. `admissionMustBeProven` binds it to the proof of invitation —
            // but that rule doesn't run on a link the resolver discards, and `invalidLinkReducer`
            // reads this field.
            required: ['id', 'memberKeys', 'memberKeys.name', 'userName', 'proof'],
            arrays: ['lockboxes'],
            serialized: ['proof.id', 'proof.invitee', 'proof.keyHash'],
            numbers: ['memberKeys.generation'],
            base58: ['memberKeys.encryption', 'memberKeys.signature', 'proof.signature'],
          },
          {
            type: 'ADMIT_DEVICE',
            payload: { id: deviceInvitation.id, device, proof, lockboxes },
            // An admission is the fourth place a device arrives, and it gets the same rule as the
            // other three — leaving its identifiers to `admissionMustBeProven` was only ever sound
            // while that rule ran, and a discarded link goes to `invalidLinkReducer` instead
            required: ['id', 'device', 'device.keys', 'device.deviceId', 'device.userId', 'proof'],
            arrays: ['lockboxes'],
            serialized: ['proof.id', 'proof.invitee', 'proof.keyHash'],
            numbers: ['device.keys.generation'],
            base58: ['device.keys.encryption', 'device.keys.signature', 'proof.signature'],
          },
          {
            type: 'CHANGE_MEMBER_KEYS',
            payload: { keys, lockboxes },
            required: ['keys', 'keys.name'],
            arrays: ['lockboxes'],
            serialized: [],
            numbers: ['keys.generation'],
            base58: ['keys.encryption', 'keys.signature'],
          },
          {
            type: 'ADD_SERVER',
            payload: { server, lockboxes },
            required: ['server', 'server.keys', 'server.host'],
            arrays: ['lockboxes'],
            serialized: [],
            numbers: ['server.keys.generation'],
            base58: ['server.keys.encryption', 'server.keys.signature'],
          },
          {
            type: 'REMOVE_SERVER',
            payload: { host: server.host, lockboxes },
            required: ['host'],
            arrays: ['lockboxes'],
            serialized: [],
            numbers: [],
            base58: [],
          },
          // Nothing takes these apart: the message and the team name are stored as they arrive
          {
            type: 'MESSAGE',
            payload: { message: 'hello', lockboxes },
            required: [],
            arrays: ['lockboxes'],
            serialized: [],
            numbers: [],
            base58: [],
          },
          {
            type: 'SET_TEAM_NAME',
            payload: { teamName: 'Team', lockboxes },
            required: [],
            arrays: ['lockboxes'],
            serialized: [],
            numbers: [],
            base58: [],
          },
        ]

        return { alice, bob, cases }
      }

      /** Every variant of a case that has to be refused, as `[label, action]` */
      const brokenVariants = (
        { type, payload, required, arrays, serialized, numbers, base58 }: ShapeCase,
        aRealLockbox: Lockbox,
        someoneElsesDevice: Device
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

        // A field that ends up in libsodium has to be base58 of the right length. Both spellings of
        // nothing are here for the same reason they are above, and so are the three ways a string
        // can still be unusable: not a string at all, the right alphabet at the wrong length (''
        // and 'zzz' both decode fine and both blow up in libsodium), and the wrong alphabet.
        for (const field of base58) {
          for (const value of [null, undefined, 1234, '', 'zzz', 'not-base58!!!']) {
            variants.push([
              `${type} ${field}=${JSON.stringify(value)}`,
              { type, payload: setPath(payload, field, value) },
            ])
          }
        }

        // A field something serializes has to be a string. The two spellings of nothing are here
        // for the reason they always are; `1234` and `''` are the ordinary ways a string field
        // isn't one; and `1n` is the one that only serialization notices — msgpackr round-trips it
        // intact, and `JSON.stringify` throws on it rather than answering.
        for (const field of serialized) {
          for (const value of [null, undefined, 1234, '', 1n]) {
            variants.push([
              `${type} ${field}=${String(value)}`,
              { type, payload: setPath(payload, field, value) },
            ])
          }
        }

        // A field something adds to has to be a number. `1n` is the one that matters — it compares
        // fine everywhere it's compared, so it reaches the line that adds to it and throws there.
        // The rest are refused because a generation is a number, not because each has its own
        // throw: `'5'` concatenates, and the others make a generation that never matches.
        for (const field of numbers) {
          for (const value of [null, undefined, 1n, '5', {}]) {
            variants.push([
              `${type} ${field}=${String(value)}`,
              { type, payload: setPath(payload, field, value) },
            ])
          }
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
          // The key a lockbox was sealed with is decoded by its RECIPIENT and by nobody else, so
          // this is the one field on a copied lockbox that reaches only the member it names
          [
            '[lockbox with a key that is not base58]',
            [
              {
                ...aRealLockbox,
                encryptionKey: { ...aRealLockbox.encryptionKey, publicKey: 'not-base58!!!' },
              },
            ],
          ],
          [
            '[lockbox with a key of the wrong length]',
            [
              {
                ...aRealLockbox,
                encryptionKey: { ...aRealLockbox.encryptionKey, publicKey: 'zzz' },
              },
            ],
          ],
          // A manifest's `publicKey` is a key too, and the recipient's is decoded: `lockbox.rotate`
          // hands the old manifest back to `lockbox.create`, which encrypts to it. That's the path
          // an admin takes to re-key a compromised member, so a forged one disables the team's one
          // remedy — and the contents manifest gets the same rule, being the same field.
          [
            "[lockbox whose recipient's key is not base58]",
            [
              {
                ...aRealLockbox,
                recipient: { ...aRealLockbox.recipient, publicKey: 'not-base58!!!' },
              },
            ],
          ],
          [
            "[lockbox whose recipient's key is the wrong length]",
            [{ ...aRealLockbox, recipient: { ...aRealLockbox.recipient, publicKey: 'zzz' } }],
          ],
          [
            "[lockbox whose contents' key is not base58]",
            [
              {
                ...aRealLockbox,
                contents: { ...aRealLockbox.contents, publicKey: 'not-base58!!!' },
              },
            ],
          ],
          [
            "[lockbox whose contents' key is the wrong length]",
            [{ ...aRealLockbox, contents: { ...aRealLockbox.contents, publicKey: 'zzz' } }],
          ],
          // A generation is added to, not just compared, and `lockboxesInScope` picks the HIGHEST
          // one in scope — so a BigInt is selected first and guaranteed to reach the line that
          // adds to it
          [
            '[lockbox whose generation is a BigInt]',
            [{ ...aRealLockbox, contents: { ...aRealLockbox.contents, generation: 1n } }],
          ],
          [
            '[lockbox whose generation is a string]',
            [{ ...aRealLockbox, contents: { ...aRealLockbox.contents, generation: '5' } }],
          ],
          [
            "[lockbox whose recipient's generation is missing]",
            [{ ...aRealLockbox, recipient: { ...aRealLockbox.recipient, generation: null } }],
          ],
          // A manifest also carries the public half of the keyset it names, and `removeDevice`
          // promotes those into the member's own keys
          [
            "[lockbox claiming a member's encryption key is not base58]",
            [
              {
                ...aRealLockbox,
                contents: { ...aRealLockbox.contents, generation: 5, encryption: 'not-base58!!!' },
              },
            ],
          ],
          [
            "[lockbox claiming a member's signature key is null]",
            [
              {
                ...aRealLockbox,
                contents: { ...aRealLockbox.contents, generation: 5, signature: null },
              },
            ],
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
            ],
            // Well-shaped in every field, and still unreplayable: a device carried on a member is
            // filed under that member and never checked against them again, so the throw lands on
            // the next link that removes it
            [
              `${type} ${memberField}.devices=[somebody else's device]`,
              {
                type,
                payload: setPath(payload, `${memberField}.devices`, [someoneElsesDevice]),
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

        const someoneElsesDevice = redactDevice(alice.device)
        const outcomes = cases
          .flatMap(shapeCase => brokenVariants(shapeCase, aRealLockbox, someoneElsesDevice))
          .map(([label, action]) =>
            outcome(label, () => {
              alice.team.dispatch(action as TeamAction)
            })
          )

        // Every one of them refused, and none of them by a TypeError
        expect(outcomes.filter(result => !result.endsWith('refused'))).toEqual([])
        expect(outcomes).toHaveLength(675)

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

        const someoneElsesDevice = redactDevice(alice.device)
        for (const [label, action] of cases.flatMap(c =>
          brokenVariants(c, aRealLockbox, someoneElsesDevice)
        )) {
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
