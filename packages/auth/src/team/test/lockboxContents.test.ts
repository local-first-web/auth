import { createKeyset, type Store } from '@localfirst/crdx'
import { asymmetric } from '@localfirst/crypto'
import { describe, expect, it } from 'vitest'
import { redactDevice } from '../../device/index.js'
import { create, open, type Lockbox } from '../../lockbox/index.js'
import { KeyType } from '../../util/index.js'
import { setup, type UserStuff } from '../../util/testing/index.js'
import * as teams from '../index.js'
import * as select from '../selectors/index.js'
import { type TeamAction, type TeamContext, type TeamState } from '../types.js'

const { USER, TEAM } = KeyType

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

    it("doesn't displace the real keys it was addressed over", () => {
      const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])
      const realTeamKeys = alice.team.teamKeys()

      // The forged lockbox copies the manifest of a real one holding the team keys, and puts team
      // keys of 👨🏻‍🦲 Bob's own behind it — same scope, same generation, different secrets
      bobPostsALockboxForAlice(bob, alice.userId, createKeyset({ type: TEAM, name: TEAM }))
      alice.team.merge(bob.team.graph)

      // ✅ 👩🏾 Alice still has the team's own keys, not the ones 👨🏻‍🦲 Bob minted
      expect(alice.team.teamKeys()).toEqual(realTeamKeys)
    })
  })

  describe('lockbox.open', () => {
    it('answers with nothing rather than junk, and still opens what it should', () => {
      const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])

      const teamKeys = alice.team.teamKeys()

      // ✅ The honest lockbox opens, and holds what its manifest says
      expect(open(create(teamKeys, alice.user.keys), alice.user.keys)).toEqual(teamKeys)

      // ✅ Keys that aren't the recipient's get nothing, rather than a throw out of msgpack.
      // (A second lockbox, because `open` is memoized on the lockbox it's given.)
      expect(open(create(teamKeys, alice.user.keys), bob.user.keys)).toBeUndefined()
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
