import { ADMIN } from '/role'
import { setup } from '/util/testing'
import '/util/testing/expect/toLookLikeKeyset'
import * as keysets from '/keyset'

const { MEMBER } = keysets.KeyType

describe('Team', () => {
  describe('keys', () => {
    it('Alice has admin keys and team keys', () => {
      const { alice } = setup(['alice'])
      const adminKeys = alice.team.roleKeys(ADMIN)
      expect(adminKeys).toLookLikeKeyset()

      const teamKeys = alice.team.teamKeys()
      expect(teamKeys).toLookLikeKeyset()
    })

    it('Bob has team keys', () => {
      const { bob } = setup(['alice', 'bob'])

      // Bob has team keys
      const teamKeys = bob.team.teamKeys()
      expect(teamKeys).toLookLikeKeyset()
    })

    it(`if Bob isn't admin he doesn't have admin keys`, () => {
      const { bob } = setup(['alice', { user: 'bob', admin: false }])

      // Bob is not an admin so he doesn't have admin keys
      const bobLooksForAdminKeys = () => bob.team.roleKeys(ADMIN)
      expect(bobLooksForAdminKeys).toThrow()
    })

    it('if Bob is an admin he has admin keys', () => {
      const { bob } = setup(['alice', { user: 'bob', admin: true }])

      // Bob is an admin so he does have admin keys
      const adminKeys = bob.team.roleKeys(ADMIN)
      expect(adminKeys).toLookLikeKeyset()
    })

    it('after changing his keys, Bob still has team keys', () => {
      const { bob } = setup(['alice', 'bob'])

      // Bob has team keys
      const teamKeys = bob.team.teamKeys()
      expect(teamKeys).toLookLikeKeyset()
      expect(teamKeys.generation).toBe(0)

      // Bob changes his user keys
      const newKeys = keysets.create({ type: MEMBER, name: 'bob' })
      bob.team.changeKeys(newKeys)

      // Bob still has access to team keys
      const teamKeys2 = bob.team.teamKeys()
      expect(teamKeys2).toLookLikeKeyset()
      expect(teamKeys2.generation).toBe(1) // the team keys were rotated, so these are new
    })
  })
})
