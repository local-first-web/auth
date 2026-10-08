import { createKeyset, redactKeys, type KeysetWithSecrets, type Store } from '@localfirst/crdx'
import { asymmetric } from '@localfirst/crypto'
import { describe, expect, it } from 'vitest'
import { redactDevice } from '../../device/index.js'
import { create, open, type Lockbox } from '../../lockbox/index.js'
import { KeyType } from '../../util/index.js'
import { setup, type UserStuff } from '../../util/testing/index.js'
import * as teams from '../index.js'
import * as select from '../selectors/index.js'
import { type TeamAction, type TeamContext, type TeamState } from '../types.js'

const { USER, TEAM, ROLE } = KeyType

/**
 * A lockbox's payload is ciphertext addressed to one recipient, so nobody else can see what it
 * unpacks to — no shape check at the door can say whether it holds a keyset. What the recipient
 * can do is decline to use what comes out, which is what these pin: a lockbox that opens to
 * anything but the keyset its own manifest describes is one this device has no keys from, and
 * nothing downstream is handed the junk.
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

/**
 * 👨🏻‍🦲 Bob copies the manifests off a lockbox addressed to 👩🏾 Alice — they're plaintext — and puts
 * a payload of his own choosing behind them, encrypted to her public key with a fresh ephemeral
 * keypair. He hangs it off an ADD_DEVICE for a device of his own, which any member may post.
 */
const bobPostsALockboxForAlice = (bob: UserStuff, aliceUserId: string, payload: unknown) => {
  const real = bob.team.state.lockboxes.find(
    ({ recipient }) => recipient.type === USER && recipient.name === aliceUserId
  )!
  const ephemeral = asymmetric.keyPair()
  const encryptedPayload =
    payload === NOT_A_CIPHER
      ? new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
      : asymmetric.encryptBytes({
          secret: payload as Record<string, unknown>,
          recipientPublicKey: real.recipient.publicKey,
          senderSecretKey: ephemeral.secretKey,
        })

  const forged = {
    encryptionKey: { type: 'EPHEMERAL', publicKey: ephemeral.publicKey },
    recipient: real.recipient,
    contents: real.contents,
    encryptedPayload,
  } as Lockbox

  bobAuthorsDirectly(bob, {
    type: 'ADD_DEVICE',
    payload: { device: redactDevice(bob.phone!), lockboxes: [forged] },
  })
  return forged
}

const NOT_A_CIPHER = Symbol('not a cipher')

/** A keyset that isn't the one this lockbox's manifest says is inside */
const someoneElsesKeys = () => createKeyset({ type: USER, name: 'nobody' })

describe('Team', () => {
  describe("a lockbox whose payload isn't the keyset its manifest describes", () => {
    const cases = [
      ['bytes that are not a cipher at all', NOT_A_CIPHER],
      ['a cipher over something that is not a keyset', { hello: 'world' }],
      ['a keyset carrying a BigInt', { ...someoneElsesKeys(), generation: 1n }],
      ['a keyset from another scope entirely', someoneElsesKeys()],
      [
        'a keyset for the right scope but not the right keys',
        createKeyset({ type: TEAM, name: TEAM }),
      ],
      // The manifest these are filed behind says TEAM generation 0. Tying the payload to it is what
      // makes the checks the door does on a manifest — `isUsableGeneration` among them — mean
      // anything about what comes out of the payload, and stops a lockbox being filed under a scope
      // or generation other than the one it publicly claims.
      [
        'a keyset claiming a generation its own manifest does not',
        { ...createKeyset({ type: TEAM, name: TEAM }), generation: 1 },
      ],
      [
        'a keyset claiming a scope its own manifest does not',
        createKeyset({ type: 'ROLE', name: 'admin' }),
      ],
    ] as const

    for (const [description, payload] of cases) {
      it(`leaves its recipient's team working: ${description}`, () => {
        const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])
        const teamKeyring = alice.team.teamKeyring()

        bobPostsALockboxForAlice(bob, alice.userId, payload)

        // ✅ 👩🏾 Alice can replay his graph
        expect(() => alice.team.merge(bob.team.graph)).not.toThrow()

        // ✅ ...and everything she could do before, she can still do
        expect(alice.team.teamKeys().generation).toBe(0)
        expect(() => alice.team.addRole('managers')).not.toThrow()
        expect(alice.team.hasRole('managers')).toBe(true)

        // ✅ ...including saving her graph and loading it again
        const reloaded = teams.load(
          alice.team.save(),
          { user: alice.user, device: alice.device },
          teamKeyring
        )
        expect(reloaded.hasRole('managers')).toBe(true)
      })
    }

    /**
     * A payload that is a keyset in every respect the consumers care about, and agrees with its
     * manifest on scope, generation and public key — but has no secrets in it. It's the one payload
     * the manifest-match check can't tell from an honest keyset, so it's what the well-formedness
     * check is for: without it, `teamKeys().secretKey` comes back `undefined`.
     */
    it('is refused for having no secrets in it, even when it matches its own manifest', () => {
      const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])

      // 👨🏻‍🦲 Bob mints team keys of his own at a generation 👩🏾 Alice doesn't have, describes them
      // honestly on the manifest, and puts their public half in the payload
      const bobsKeys = { ...createKeyset({ type: TEAM, name: TEAM }), generation: 1 }
      const secretless = {
        type: bobsKeys.type,
        name: bobsKeys.name,
        generation: bobsKeys.generation,
        encryption: { publicKey: bobsKeys.encryption.publicKey },
        signature: { publicKey: bobsKeys.signature.publicKey },
      }
      // The ephemeral keypair the manifest names has to be the one the payload was encrypted with,
      // or this never gets as far as looking at what's inside
      const ephemeral = asymmetric.keyPair()
      const forged = {
        ...create(bobsKeys, alice.user.keys),
        encryptionKey: { type: 'EPHEMERAL', publicKey: ephemeral.publicKey },
        encryptedPayload: asymmetric.encryptBytes({
          secret: secretless,
          recipientPublicKey: redactKeys(alice.user.keys).encryption,
          senderSecretKey: ephemeral.secretKey,
        }),
      } as Lockbox
      bobAuthorsDirectly(bob, {
        type: 'ADD_DEVICE',
        payload: { device: redactDevice(bob.phone!), lockboxes: [forged] },
      })
      alice.team.merge(bob.team.graph)

      // ✅ 👩🏾 Alice's team keys are still a keyset she can encrypt with
      expect(typeof alice.team.teamKeys().secretKey).toBe('string')
      expect(alice.team.decrypt(alice.team.encrypt('hello'))).toBe('hello')
    })

    /**
     * `keyMap` keeps the first keyset it sees for a scope and generation. Two lockboxes reaching one
     * device for the same scope and generation hold the same keyset if both are honest, so which is
     * kept can't matter on an honest graph — and decides everything on a graph where one of them
     * isn't.
     *
     * This closes only the half of auth-9sl where the forged lockbox names a generation the
     * recipient already has. Naming one they DON'T have still displaces their view of the scope's
     * keys, because being first is automatic when nobody else has ever named it. That needs a way
     * to tell a keyset the team issued from one a member minted, which the graph doesn't carry —
     * see auth-9sl, still open.
     */
    it("doesn't displace keys the recipient already has for that generation", () => {
      const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])
      const realTeamKeys = alice.team.teamKeys()

      // 👨🏻‍🦲 Bob mints team keys of his own at generation 0, describes them honestly, and addresses
      // them to 👩🏾 Alice. No forged number anywhere — his link simply comes later than hers.
      const bobsKeys = createKeyset({ type: TEAM, name: TEAM })
      bobAuthorsDirectly(bob, {
        type: 'ADD_DEVICE',
        payload: {
          device: redactDevice(bob.phone!),
          lockboxes: [create(bobsKeys, alice.user.keys)],
        },
      })
      alice.team.merge(bob.team.graph)

      // ✅ 👩🏾 Alice still has the team's own keys, not the ones 👨🏻‍🦲 Bob minted
      expect(alice.team.teamKeys()).toEqual(realTeamKeys)
      expect(alice.team.teamKeys().secretKey).not.toBe(bobsKeys.secretKey)
    })
  })

  describe('a keyset whose fields are strings but not keys', () => {
    it("doesn't become keys its recipient tries to use", () => {
      const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])

      // Every field is present and every field is a non-empty string, so a check that asks only
      // that much is satisfied — and the manifest is built by redacting this, so it agrees with
      // itself too. What isn't true is that any of the secrets is a key.
      const keypair = asymmetric.keyPair()
      const notKeys = {
        type: ROLE,
        name: 'managers',
        generation: 0,
        secretKey: 'notAKey',
        encryption: { publicKey: keypair.publicKey, secretKey: 'notAKey' },
        signature: { publicKey: keypair.publicKey, secretKey: 'notAKey' },
      }

      // Addressed to 👩🏾 Alice's user keys, which is where a role's keys honestly reach her — and
      // naming a role she has no keys for, so nothing else is competing to be the answer
      bobAuthorsDirectly(bob, {
        type: 'ADD_DEVICE',
        payload: {
          device: redactDevice(bob.phone!),
          lockboxes: [create(notKeys as unknown as KeysetWithSecrets, alice.user.keys)],
        },
      })
      alice.team.merge(bob.team.graph)

      // ✅ 👩🏾 Alice has no keys for that role, rather than a keyset of strings she'd hand libsodium
      expect(() => alice.team.roleKeys('managers')).toThrowError(/Couldn't find keys/)
    })
  })

  describe('a lockbox addressed to a device', () => {
    /**
     * `visibleKeys` walks device -> user -> team, so a member's real team keys are two steps out. A
     * lockbox holding team keys of the author's own, addressed to somebody's DEVICE, reaches them
     * in one step — and a device encryption key is plaintext on every lockbox recipient manifest,
     * so addressing it takes nothing. That beat the real keys for every member at once, at
     * generation 0, with no forged number anywhere.
     *
     * No walk order fixes this: the honest delivery is always deeper than the forgery, and an
     * attacker appending later always wins the other way round. What settles it is that no honest
     * path produces this lockbox at all.
     */
    it("can't hold anything but the keys of the user it belongs to", () => {
      const { alice, bob, charlie, dwight } = setup([
        'alice',
        'charlie',
        { user: 'bob', admin: false },
        { user: 'dwight', admin: false },
      ])
      const realTeamKeys = alice.team.teamKeys()
      const bobsKeys = createKeyset({ type: TEAM, name: TEAM })

      // 👨🏻‍🦲 Bob aims one ADD_DEVICE at everyone else's device at once, both admins included
      bobAuthorsDirectly(bob, {
        type: 'ADD_DEVICE',
        payload: {
          device: redactDevice(bob.phone!),
          lockboxes: [alice, charlie, dwight].map(victim =>
            create(bobsKeys, redactKeys(victim.device.keys))
          ),
        },
      })

      // ✅ Nobody replays it
      for (const victim of [alice, charlie, dwight]) {
        expect(() => victim.team.merge(bob.team.graph)).toThrowError(/addressed to a device/)
        expect(victim.team.teamKeys().secretKey).not.toBe(bobsKeys.secretKey)
      }

      // ✅ ...and 👩🏾 Alice still holds the team's own keys, so the team still works
      expect(alice.team.teamKeys()).toEqual(realTeamKeys)
      expect(alice.team.decrypt(alice.team.encrypt('hello'))).toBe('hello')
    })

    it('still carries the user keys it should', () => {
      const { bob } = setup(['alice', { user: 'bob', admin: false }])

      // ✅ The honest shape — a member's own user keys, to a device of their own — still goes on
      bob.team.dispatch({
        type: 'ADD_DEVICE',
        payload: {
          device: redactDevice(bob.phone!),
          lockboxes: [create(bob.user.keys, bob.phone!.keys)],
        },
      })
      expect(bob.team.members(bob.userId).devices).toHaveLength(2)
    })
  })

  describe('a run of lockboxes that points back at itself', () => {
    /**
     * 👨🏻‍🦲 Bob mints two keysets of his own and puts each one in a lockbox the other one opens.
     * Nothing here is malformed: every lockbox holds exactly the keyset its manifest describes, and
     * every pairing is one an honest flow produces — ROLE to USER, then ROLE to ROLE. What's wrong
     * is the shape of the run, and only a walk can see it.
     *
     * There are two walks over the lockbox graph and they are easy to mistake for each other, so
     * both are exercised here. `visibleKeys` is reached by reading keys; `visibleScopes` is reached
     * only by ROTATING them, which is why a version of this test that stopped at `merge` and
     * `addRole` passed for two rounds while `Team.rotateKeys` still went round the loop forever.
     */
    /** The cycle proper: k1 -> k2 -> k1, addressed into the victim's own reach */
    const postACycleAimedAt = (bob: UserStuff, victim: UserStuff) => {
      const k1 = createKeyset({ type: ROLE, name: 'x1' })
      const k2 = createKeyset({ type: ROLE, name: 'x2' })
      bobAuthorsDirectly(bob, {
        type: 'ADD_DEVICE',
        payload: {
          device: redactDevice(bob.phone!),
          lockboxes: [create(k1, victim.user.keys), create(k2, k1), create(k1, k2)],
        },
      })
    }

    it("doesn't send its recipient into an endless walk", () => {
      const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])
      const teamKeyring = alice.team.teamKeyring()

      postACycleAimedAt(bob, alice)

      // ✅ 👩🏾 Alice replays it, goes on working, and can reload her own saved graph
      expect(() => alice.team.merge(bob.team.graph)).not.toThrow()
      expect(() => alice.team.addRole('managers')).not.toThrow()
      const reloaded = teams.load(
        alice.team.save(),
        { user: alice.user, device: alice.device },
        teamKeyring
      )
      expect(reloaded.hasRole('managers')).toBe(true)
    })

    /**
     * Aimed at a member's own scope, this took away the only two remediations the team has against
     * that member: `remove` and `changeKeys` both walk `visibleScopes` from the scope being
     * rotated, and both threw `Maximum call stack size exceeded`, for every admin, permanently,
     * surviving a reload — while removing anybody else went on working, so nothing looked broken.
     */
    it("doesn't stop the member it names from being removed or re-keyed", () => {
      const poisoned = () => {
        const team = setup([
          'alice',
          { user: 'bob', admin: false },
          { user: 'charlie', admin: false },
        ])
        postACycleAimedAt(team.bob, team.charlie)
        team.alice.team.merge(team.bob.team.graph)
        return team
      }

      // ✅ 👳🏽‍♂️ Charlie can still be removed
      const removal = poisoned()
      expect(() => removal.alice.team.remove(removal.charlie.userId)).not.toThrow()

      // ✅ ...and re-keyed, which is the other remediation
      const rekey = poisoned()
      expect(() =>
        rekey.alice.team.changeKeys(createKeyset({ type: USER, name: rekey.charlie.userId }))
      ).not.toThrow()

      // ✅ ...and it survives a reload
      const reloaded = poisoned()
      const copy = teams.load(
        reloaded.alice.team.save(),
        { user: reloaded.alice.user, device: reloaded.alice.device },
        reloaded.alice.team.teamKeyring()
      )
      expect(() => copy.remove(reloaded.charlie.userId)).not.toThrow()

      // ✅ ...and a role rotation, which walks the same scopes
      const role = poisoned()
      role.alice.team.addRole('managers')
      role.alice.team.addMemberRole(role.charlie.userId, 'managers')
      expect(() => role.alice.team.removeMemberRole(role.charlie.userId, 'managers')).not.toThrow()
    })

    it('still lets a legitimate chain of lockboxes deliver its keys', () => {
      const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])

      // a -> b -> c, no cycle: the guard must not cut a walk short
      const a = createKeyset({ type: ROLE, name: 'a' })
      const b = createKeyset({ type: ROLE, name: 'b' })
      const c = createKeyset({ type: ROLE, name: 'c' })
      bobAuthorsDirectly(bob, {
        type: 'ADD_DEVICE',
        payload: {
          device: redactDevice(bob.phone!),
          lockboxes: [create(a, alice.user.keys), create(b, a), create(c, b)],
        },
      })
      alice.team.merge(bob.team.graph)

      // ✅ Both walks reach the far end of the chain
      expect(select.visibleKeys(alice.team.state, alice.user.keys).map(k => k.name)).toEqual(
        expect.arrayContaining(['a', 'b', 'c'])
      )
      expect(
        select.visibleScopes(alice.team.state, { type: USER, name: alice.userId }).map(s => s.name)
      ).toEqual(expect.arrayContaining(['a', 'b', 'c']))
    })
  })

  describe('lockbox.open', () => {
    it('answers with nothing rather than junk, and still opens what it should', () => {
      const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])

      const teamKeys = alice.team.teamKeys()

      // ✅ The honest lockbox opens, and holds what its manifest says
      expect(open(create(teamKeys, alice.user.keys), alice.user.keys)).toEqual(teamKeys)

      // ✅ Keys that aren't the recipient's get nothing, rather than a throw out of msgpack
      const forSomeoneElse = create(teamKeys, alice.user.keys)
      expect(open(forSomeoneElse, bob.user.keys)).toBeUndefined()

      // ✅ ...and being asked with the wrong keys first doesn't answer for the right ones. Both
      // arguments decide the answer, so both are in the memo key.
      expect(open(forSomeoneElse, alice.user.keys)).toEqual(teamKeys)
    })
  })

  describe('select.keys', () => {
    it("still says which keys it couldn't find, without dumping the ones it did", () => {
      const { alice } = setup('alice')

      // ✅ The keys that are there come back
      expect(select.keys(alice.team.state, alice.device.keys, { type: TEAM, name: TEAM })).toEqual(
        alice.team.teamKeys()
      )

      // ✅ ...and the ones that aren't produce a message naming the scope, with no keysets in it
      let message = ''
      try {
        select.keys(alice.team.state, alice.device.keys, { type: 'ROLE', name: 'managers' })
      } catch (error) {
        message = (error as Error).message
      }

      expect(message).toMatch(/Couldn't find keys/)
      expect(message).toMatch(/ROLE:managers/)
      expect(message).not.toContain(alice.team.teamKeys().secretKey)
    })
  })
})
