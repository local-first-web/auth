import { createKeyset, redactKeys } from '@localfirst/crdx'
import { generateProof } from '../../invitation/index.js'
import { ADMIN } from '../../role/index.js'
import { KeyType } from '../../util/index.js'
import '../../util/testing/expect/toLookLikeKeyset.js'
import { setup } from '../../util/testing/index.js'
import { describe, expect, it } from 'vitest'

const { USER, DEVICE } = KeyType

describe('Team', () => {
  describe('keys', () => {
    it('Alice has admin keys and team keys', () => {
      const { alice } = setup('alice')
      const adminKeys = alice.team.roleKeys(ADMIN)
      expect(adminKeys).toLookLikeKeyset()

      const teamKeys = alice.team.teamKeys()
      expect(teamKeys).toLookLikeKeyset()
    })

    it('Bob has team keys', () => {
      const { bob } = setup('alice', 'bob')

      // Bob has team keys
      const teamKeys = bob.team.teamKeys()
      expect(teamKeys).toLookLikeKeyset()
    })

    it("if Bob isn't admin he doesn't have admin keys", () => {
      const { bob } = setup('alice', { user: 'bob', admin: false })

      // Bob is not an admin so he doesn't have admin keys
      const bobLooksForAdminKeys = () => bob.team.roleKeys(ADMIN)
      expect(bobLooksForAdminKeys).toThrow()
    })

    it('if Bob is an admin he has admin keys', () => {
      const { bob } = setup('alice', { user: 'bob', admin: true })

      // Bob is an admin so he does have admin keys
      const adminKeys = bob.team.roleKeys(ADMIN)
      expect(adminKeys).toLookLikeKeyset()
    })

    it('after changing his keys, Bob still has team keys', () => {
      const { bob } = setup('alice', 'bob')

      // Bob has team keys
      const teamKeys = bob.team.teamKeys()
      expect(teamKeys).toLookLikeKeyset()
      expect(teamKeys.generation).toBe(0)

      // Bob changes his user keys
      const newKeys = createKeyset({ type: USER, name: bob.userId })
      bob.team.changeKeys(newKeys)

      // Bob still has access to team keys
      const teamKeys2 = bob.team.teamKeys()
      expect(teamKeys2).toLookLikeKeyset()
      expect(teamKeys2.generation).toBe(1) // The team keys were rotated, so these are new
    })

    it("Alice can change Bob's keys", () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: false })

      const newKeys = createKeyset({ type: USER, name: bob.userId })
      const tryToChangeBobsKeys = () => {
        alice.team.changeKeys(newKeys)
      }

      expect(tryToChangeBobsKeys).not.toThrow()
    })

    /**
     * `changeKeys` used to write the keyset it was handed back to `context.user.keys` no matter
     * whose name was on it, so an admin who re-keyed someone else was left holding a keyset
     * belonging to that member. Nothing repaired it — `updateUserKeys` only moves the context
     * forward to a *later* generation of the user's own keys — so every link she signed after that
     * was encrypted with someone else's keys, and `linkAuthorshipIsAuthentic` rejected it.
     */
    it("changing Bob's keys leaves Alice's own keys alone", () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: false })

      // Alice rotates her own keys first, so her generation is ahead of Bob's
      alice.team.changeKeys(createKeyset({ type: USER, name: alice.userId }))
      const alicesKeys = alice.team.members(alice.userId).keys

      alice.team.changeKeys(createKeyset({ type: USER, name: bob.userId }))

      // Bob's keys are the ones that were replaced, and they supersede *his* generation, not hers
      expect(alice.team.members(bob.userId).keys.generation).toBe(1)
      expect(alice.team.members(alice.userId).keys).toEqual(alicesKeys)

      // `alice.user` is the very object the team holds as `context.user`
      expect(alice.user.keys.name).toBe(alice.userId)
      expect(alice.user.keys.signature.publicKey).toBe(alicesKeys.signature)

      // ...so she can still sign links that are recognizably hers
      alice.team.addRole('managers')
      expect(alice.team.hasRole('managers')).toBe(true)
    })

    /** The other half of that: the member whose keys were changed does end up with them. */
    it('Bob picks up the keys Alice made for him', () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: false })

      const bobsNewKeys = createKeyset({ type: USER, name: bob.userId })
      alice.team.changeKeys(bobsNewKeys)
      bob.team.merge(alice.team.graph)

      expect(bob.user.keys.encryption.secretKey).toBe(bobsNewKeys.encryption.secretKey)
      expect(bob.team.members(bob.userId).keys.generation).toBe(1)
      expect(bob.team.teamKeys().generation).toBe(1)
    })

    /**
     * The new keys supersede the target member's generation, not the caller's.
     *
     * Usually you can't tell, because `lockbox.rotate` derives the generation from each lockbox it
     * replaces and overwrites whatever `changeKeys` computed. It stands only when the member has no
     * lockbox of their own to rotate — and there's a window in the ordinary join where that's true.
     * `admitMember` posts ADMIT_MEMBER with lockboxes holding the *team* keys; the lockbox holding
     * the member's own user keys isn't created until they add a device. Between those two links
     * (`Connection` walks this path: admitMember, then the invitee's ADD_DEVICE) the member is on
     * the team with nothing in their own scope, and it's the caller's generation that lands on
     * them — which can be lower than, or equal to, one they've already used.
     */
    it("a member's keys supersede that member's generation, not the caller's", () => {
      const { alice, bob } = setup('alice', { user: 'bob', member: false })

      // Alice's own keys are two generations ahead
      alice.team.changeKeys(createKeyset({ type: USER, name: alice.userId }))
      alice.team.changeKeys(createKeyset({ type: USER, name: alice.userId }))
      expect(alice.team.members(alice.userId).keys.generation).toBe(2)

      // Bob is admitted by invitation, and hasn't added a device yet
      const { seed } = alice.team.inviteMember()
      alice.team.admitMember(generateProof(seed, bob.user.keys), bob.user.keys, bob.user.userName)
      expect(alice.team.members(bob.userId).keys.generation).toBe(0)
      expect(alice.team.members(bob.userId).devices ?? []).toHaveLength(0)

      alice.team.changeKeys(createKeyset({ type: USER, name: bob.userId }))
      expect(alice.team.members(bob.userId).keys.generation).toBe(1)
    })

    /**
     * Belt and braces, not the load-bearing part: deleting the `user.keys = newKeys` line leaves
     * this green, because `dispatch` emits `updated`, and that handler's `updateUserKeys` finds the
     * new keyset in the lockbox `rotateKeys` just addressed to Bob's device. What this pins is the
     * outcome either way — that after rotating, Bob's context holds keys the graph recognizes as
     * his, so the next link he signs is his. (A member with no device lockbox, where the assignment
     * would be the only thing that repaired the context, can't reach this code: opening the team's
     * keys at all starts from the device keyring.)
     */
    it('Bob can rotate his own keys twice running', () => {
      const { bob } = setup('alice', 'bob')

      bob.team.changeKeys(createKeyset({ type: USER, name: bob.userId }))
      expect(bob.user.keys.name).toBe(bob.userId)
      expect(bob.user.keys.signature.publicKey).toBe(bob.team.members(bob.userId).keys.signature)

      // The second rotation is signed with the keys the first one put in his context
      bob.team.changeKeys(createKeyset({ type: USER, name: bob.userId }))
      expect(bob.team.members(bob.userId).keys.generation).toBe(2)
      expect(bob.user.keys.signature.publicKey).toBe(bob.team.members(bob.userId).keys.signature)
    })

    it('Every time Alice changes her keys, the admin keys are rotated', () => {
      const { alice } = setup('alice')
      const changeKeys = () => {
        const newKeys = { type: KeyType.USER, name: alice.userId }
        alice.team.changeKeys(createKeyset(newKeys))
      }

      expect(alice.team.adminKeys().generation).toBe(0)
      expect(alice.team.state.lockboxes.length).toBe(3) // Team keys for alice, admin keys for alice, alice user keys for alice's laptop

      changeKeys()
      changeKeys()
      changeKeys()
      expect(alice.team.adminKeys().generation).toBe(3)
      expect(alice.team.state.lockboxes.length).toBe(12) // The number of lockboxes shouldn't grow exponentially
    })

    it("Bob can't change Alice's keys", () => {
      const { bob } = setup('alice', { user: 'bob', admin: false })

      const newKeys = createKeyset({ type: USER, name: 'alice' })
      const tryToChangeAlicesKeys = () => {
        bob.team.changeKeys(newKeys)
      }

      expect(tryToChangeAlicesKeys).toThrow()
    })

    it("Bob can't change Alice's device keys", () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: false })

      const { deviceId } = alice.device
      const newKeys = createKeyset({ type: DEVICE, name: deviceId })

      const tryToChangeAlicesKeys = () => {
        bob.team.changeKeys(newKeys)
      }

      expect(tryToChangeAlicesKeys).toThrow()
    })

    it("Eve can't change Bob's keys", () => {
      // Eve is tricker than Bob -- rather than try to go through the team object, she's going to
      // try to tamper with the team chain directly.
      const { eve } = setup('alice', 'bob', { user: 'eve', admin: false })
      const newKeys = createKeyset({ type: USER, name: 'bob' })

      // @ts-expect-error - rotateKeys is private
      const lockboxes = eve.team.rotateKeys(newKeys)

      const tryToChangeBobsKeys = () => {
        eve.team.dispatch({
          type: 'CHANGE_MEMBER_KEYS',
          payload: {
            keys: redactKeys(newKeys),
            lockboxes,
          },
        })
      }

      expect(tryToChangeBobsKeys).toThrow()
    })
  })
})
