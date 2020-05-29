import {
  bob,
  bobsContext,
  charlie,
  defaultContext,
  expectToLookLikeKeyset,
  storage,
  teamChain,
} from './utils'
import { ADMIN } from '/role'
import { Team } from '/team'
import { redactUser } from '/user'

describe('Team', () => {
  beforeEach(() => {
    localStorage.clear()
    storage.contents = undefined
  })

  const setup = () => {
    const context = defaultContext
    const team = new Team({ source: teamChain, context })
    return { team, context }
  }

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
      expectToLookLikeKeyset(adminKeyset)

      const teamKeys = team.teamKeys()
      expectToLookLikeKeyset(teamKeys)
    })

    it('adds a member', () => {
      const { team } = setup()
      team.add(redactUser(bob))
      expect(team.members().length).toBe(2)
      expect(team.members('bob').userName).toBe('bob')
    })

    it('makes lockboxes for added members', () => {
      // Alice creates a team, adds Bob, and persists it
      const { team } = setup()
      team.add(redactUser(bob))
      storage.save(team)

      // Bob loads the team
      const bobsTeam = storage.load(bobsContext)

      // Bob has team keys
      const teamKeys = bobsTeam.teamKeys()
      expectToLookLikeKeyset(teamKeys)

      // Bob is not an admin so he doesn't have admin keys
      const bobLooksForAdminKeys = () => bobsTeam.roleKeys(ADMIN)
      expect(bobLooksForAdminKeys).toThrow(/not found/)
    })

    it('makes an admin lockbox for an added admin member', () => {
      // Alice creates a team, adds Bob as an admin, and persists it
      const { team } = setup()
      team.add(redactUser(bob), [ADMIN])
      storage.save(team)

      // Bob loads the team
      const bobsTeam = storage.load(bobsContext)

      // Bob is an admin and has admin keys
      const adminKeyset = bobsTeam.roleKeys(ADMIN)
      expectToLookLikeKeyset(adminKeyset)
    })

    it('does not add a member that is already present', () => {
      const { team } = setup()
      const addBob = () => team.add(redactUser(bob))
      expect(addBob).not.toThrow()

      // try adding bob again
      const addBobAgain = () => team.add(redactUser(bob))
      expect(addBobAgain).toThrow(/already a member/)
    })

    it('removes a member', () => {
      const { team } = setup()

      team.add(redactUser(bob))
      expect(team.has('bob')).toBe(true)

      team.remove('bob')
      expect(team.has('bob')).toBe(false)
    })

    it('throws if asked to remove a nonexistent member', () => {
      const { team } = setup()

      // try removing bob although he hasn't been added
      const removeBob = () => team.remove('bob')
      expect(removeBob).toThrow(/no member/)
    })

    it('gets an individual member', () => {
      const { team } = setup()
      team.add(redactUser(bob))
      const member = team.members('bob')
      expect(member.userName).toBe('bob')
    })

    it('throws if asked to get a nonexistent member', () => {
      const { team } = setup()
      team.add(redactUser(bob))

      const getNed = () => team.members('ned')
      expect(getNed).toThrow(/not found/)
    })

    it('lists all members', () => {
      const { team } = setup()

      expect(team.members()).toHaveLength(1)
      expect(team.members().map(m => m.userName)).toEqual(['alice'])

      team.add(redactUser(bob))
      team.add(redactUser(charlie))
      expect(team.members()).toHaveLength(3)
      expect(team.members().map(m => m.userName)).toEqual(['alice', 'bob', 'charlie'])
    })

    it.todo('rotates keys after removing a member')

    it.todo('automatically resolves concurrent edits')
  })
})
