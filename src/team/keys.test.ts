import { ADMIN } from '/role'
import { setup, storage } from '/util/testing'
import '/util/testing/expect/toLookLikeKeyset'
import * as keysets from '/keyset'

describe('Team', () => {
  beforeEach(() => {
    localStorage.clear()
    storage.contents = undefined
  })

  describe('keys', () => {
    it('Alice has admin keys and team keys', () => {
      const { alice } = setup(['alice'])
      const adminKeys = alice.team.roleKeys(ADMIN)
      expect(adminKeys).toLookLikeKeyset()

      const teamKeys = alice.team.teamKeys()
      expect(teamKeys).toLookLikeKeyset()
    })

    it('Bob has team keys', () => {
      // Alice creates a team, adds Bob, and persists it
      const { alice, bob } = setup(['alice', { user: 'bob', member: false }])
      alice.team.add(bob.user)
      storage.save(alice.team)

      // Bob loads the team
      const bobsTeam = storage.load(bob.localContext)

      // Bob has team keys
      const teamKeys = bobsTeam.teamKeys()
      expect(teamKeys).toLookLikeKeyset()

      // Bob is not an admin so he doesn't have admin keys
      const bobLooksForAdminKeys = () => bobsTeam.roleKeys(ADMIN)
      expect(bobLooksForAdminKeys).toThrow(/not found/)
    })

    it(`if Bob isn't admin he doesn't have admin keys`, () => {
      // Alice creates a team, adds Bob, and persists it
      const { alice, bob } = setup(['alice', { user: 'bob', member: false }])
      alice.team.add(bob.user)
      storage.save(alice.team)

      // Bob loads the team
      const bobsTeam = storage.load(bob.localContext)

      // Bob is not an admin so he doesn't have admin keys
      const bobLooksForAdminKeys = () => bobsTeam.roleKeys(ADMIN)
      expect(bobLooksForAdminKeys).toThrow(/not found/)
    })

    it('if Bob is an admin he has admin keys', () => {
      // Alice creates a team, adds Bob as an admin, and persists it
      const { alice, bob } = setup(['alice', { user: 'bob', member: false }])
      alice.team.add(bob.user, [ADMIN])
      storage.save(alice.team)

      // Bob loads the team
      const bobsTeam = storage.load(bob.localContext)

      // Bob has admin keys
      const adminKeys = bobsTeam.roleKeys(ADMIN)
      expect(adminKeys).toLookLikeKeyset()
    })

    it('after changing his keys, Bob still has team keys', () => {
      // Alice creates a team, adds Bob, and persists it
      const { alice, bob } = setup(['alice', { user: 'bob', member: false }])
      alice.team.add(bob.user)
      storage.save(alice.team)

      // Bob loads the team
      const bobsTeam = storage.load(bob.localContext)

      // Bob has team keys
      const teamKeys = bobsTeam.teamKeys()
      expect(teamKeys).toLookLikeKeyset()
      expect(teamKeys.generation).toBe(0)

      // Bob changes his user keys
      const newKeys = keysets.create({ type: keysets.KeyType.MEMBER, name: 'bob' })
      bobsTeam.changeKeys(newKeys)

      // Bob still has access to team keys
      const teamKeys2 = bobsTeam.teamKeys()
      expect(teamKeys2).toLookLikeKeyset()
      expect(teamKeys2.generation).toBe(1) // the team keys were rotated, so these are new
    })
  })
})
