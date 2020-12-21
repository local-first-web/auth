import { ADMIN } from '/role'
import { debug } from '/util'
import { bob, bobsContext, charlie, defaultContext, newTeam, storage } from '/util/testing'
import '/util/testing/expect/toLookLikeKeyset'

describe('Team', () => {
  beforeEach(() => {
    localStorage.clear()
    storage.contents = undefined
  })

  const setup = () => ({
    team: newTeam(),
    context: defaultContext,
  })

  describe('members', () => {
    it('has Alice as a root member', () => {
      const { team } = setup()
      expect(team.members().length).toBe(1)
      const alice = team.members('alice')
      expect(alice.userName).toBe('alice')
    })

    it('has lockboxes for Alice containing the admin and team secrets', () => {
      const { team } = setup()
      const adminKeyset = team.roleKeys(ADMIN)
      expect(adminKeyset).toLookLikeKeyset()

      const teamKeys = team.teamKeys()
      expect(teamKeys).toLookLikeKeyset()
    })

    it('adds a member', () => {
      const { team } = setup()
      team.add(bob)
      expect(team.members().length).toBe(2)
      expect(team.members('bob').userName).toBe('bob')
    })

    it('makes lockboxes for added members', () => {
      // Alice creates a team, adds Bob, and persists it
      const { team } = setup()
      team.add(bob)
      storage.save(team)

      // Bob loads the team
      const bobsTeam = storage.load(bobsContext)

      // Bob has team keys
      const teamKeys = bobsTeam.teamKeys()
      expect(teamKeys).toLookLikeKeyset()

      // Bob is not an admin so he doesn't have admin keys
      const bobLooksForAdminKeys = () => bobsTeam.roleKeys(ADMIN)
      expect(bobLooksForAdminKeys).toThrow(/not found/)
    })

    it('makes an admin lockbox for an added admin member', () => {
      // Alice creates a team, adds Bob as an admin, and persists it
      const { team } = setup()
      team.add(bob, [ADMIN])
      storage.save(team)

      // Bob loads the team
      const bobsTeam = storage.load(bobsContext)

      // Bob is an admin and has admin keys
      const adminKeyset = bobsTeam.roleKeys(ADMIN)
      expect(adminKeyset).toLookLikeKeyset()
    })

    it('does not add a member that is already present', () => {
      const { team } = setup()
      const addBob = () => team.add(bob)
      expect(addBob).not.toThrow()

      // try adding bob again
      const addBobAgain = () => team.add(bob)
      expect(addBobAgain).toThrow(/already a member/)
    })

    it('removes a member', () => {
      const { team } = setup()

      team.add(bob)
      expect(team.has('bob')).toBe(true)

      team.remove('bob')
      // expect(team.has('bob')).toBe(false)
    })

    it('rotates keys after removing a member', () => {
      const { team } = setup()
      team.addRole
      // add bob as admin
      team.add(bob, [ADMIN])

      // keys have never been rotated
      expect(team.teamKeys().generation).toBe(0)
      expect(team.adminKeys().generation).toBe(0)

      // remove bob from team
      team.remove('bob')

      // team keys & admin keys have now been rotated once
      expect(team.teamKeys().generation).toBe(1)
      expect(team.adminKeys().generation).toBe(1)
    })

    it('throws if asked to remove a nonexistent member', () => {
      const { team } = setup()

      // try removing bob although he hasn't been added
      const removeBob = () => team.remove('bob')
      expect(removeBob).toThrow(/not found/)
    })

    it('gets an individual member', () => {
      const { team } = setup()
      team.add(bob)
      const member = team.members('bob')
      expect(member.userName).toBe('bob')
    })

    it('throws if asked to get a nonexistent member', () => {
      const { team } = setup()
      team.add(bob)

      const getNed = () => team.members('ned')
      expect(getNed).toThrow(/not found/)
    })

    it('lists all members', () => {
      const { team } = setup()

      expect(team.members()).toHaveLength(1)
      expect(team.members().map(m => m.userName)).toEqual(['alice'])

      team.add(bob)
      team.add(charlie)
      expect(team.members()).toHaveLength(3)
      expect(team.members().map(m => m.userName)).toEqual(['alice', 'bob', 'charlie'])
    })
  })
})
const log = debug(`lf:auth:test`)
const testName = () => expect.getState().currentTestName
beforeAll(log.clear)
beforeEach(() => log.header('TEST: ' + testName()))
