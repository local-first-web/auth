import { ADMIN } from '/role'
import { Team } from '/team'
import {
  bob,
  bobsContext,
  charlie,
  defaultContext,
  expectToLookLikeKeyset,
  managers,
  MANAGERS,
  storage,
  teamChain,
} from '/team/tests/utils'
import { redactUser } from '/user'
import { KeyType } from '/keys'

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

  describe('roles', () => {
    it('Alice is admin by default', () => {
      const { team } = setup()
      expect(team.memberIsAdmin('alice')).toBe(true)
    })

    it('Bob is not admin by default', () => {
      const { team } = setup()
      team.add(redactUser(bob))
      expect(team.memberIsAdmin('bob')).toBe(false)
    })

    it('adds a role', () => {
      const { team } = setup()
      team.addRole(managers)
      expect(team.roles().length).toBe(2)
      expect(team.roles(MANAGERS).roleName).toBe(MANAGERS)
    })

    it('admins have access to all role keys', () => {
      const { team } = setup()
      team.addRole(managers)

      // Alice is not a member of the managers role
      expect(team.memberHasRole('alice', MANAGERS)).toBe(false)

      // But Alice does have access to the managers' keys
      const managersKeys = team.roleKeys(MANAGERS)
      expectToLookLikeKeyset(managersKeys)
    })

    it('adds a member to a role', () => {
      const { team: alicesTeam } = setup()
      alicesTeam.add(redactUser(bob))

      // Bob isn't an admin yet
      expect(alicesTeam.memberIsAdmin('bob')).toBe(false)

      alicesTeam.addMemberRole('bob', ADMIN)

      // Now Bob is an admin
      expect(alicesTeam.memberIsAdmin('bob')).toBe(true)

      // Alice persists the team
      storage.save(alicesTeam)

      // Bob loads the team
      const bobsTeam = storage.load(bobsContext)

      // Bob has admin keys
      const bobsAdminKeys = bobsTeam.roleKeys(ADMIN)
      expectToLookLikeKeyset(bobsAdminKeys)
    })

    it('removes a member from a role', () => {
      const { team: alicesTeam } = setup()
      alicesTeam.add(redactUser(bob), [ADMIN])

      // Bob is an admin
      expect(alicesTeam.memberIsAdmin('bob')).toBe(true)

      // Alice removes Bob's admin role
      alicesTeam.removeMemberRole('bob', ADMIN)

      // Bob is no longer an admin
      expect(alicesTeam.memberIsAdmin('bob')).toBe(false)

      // Alice persists the team
      storage.save(alicesTeam)

      // Bob loads the team
      const bobsTeam = storage.load(bobsContext)

      // On his side, Bob can see that he is no longer an admin
      expect(bobsTeam.memberIsAdmin('bob')).toBe(false)

      // Bob doesn't have admin keys any more
      const bobLooksForAdminKeys = () => bobsTeam.roleKeys(ADMIN)
      expect(bobLooksForAdminKeys).toThrow()
    })

    it('gets an individual role', () => {
      const { team } = setup()
      const adminRole = team.roles(ADMIN)
      expect(adminRole.roleName).toBe(ADMIN)
    })

    it('throws if asked to get a nonexistent role', () => {
      const { team } = setup()
      const getNonexistentRole = () => team.roles('spatula')
      expect(getNonexistentRole).toThrow(/not found/)
    })

    it('lists all roles', () => {
      const { team } = setup()
      team.addRole(managers)
      const roles = team.roles()
      expect(roles).toHaveLength(2)
      expect(roles.map(role => role.roleName)).toEqual([ADMIN, MANAGERS])
    })

    it('allows an admin other than Alice to add a member', () => {
      // Alice creates a team and adds Bob as an admin
      const { team: alicesTeam } = setup()
      alicesTeam.add(redactUser(bob), [ADMIN]) // bob is an admin
      storage.save(alicesTeam)

      // Bob loads the team and tries to add Charlie as a member
      const bobsTeam = storage.load(bobsContext)
      const addUser = () => bobsTeam.add(redactUser(charlie))

      // Bob is allowed because he is an admin
      expect(addUser).not.toThrow()
    })

    it('does not allow a non-admin to add a member', () => {
      // Alice creates a team and adds Bob with no admin rights
      const { team: alicesTeam } = setup()
      alicesTeam.add(redactUser(bob), []) // Bob is not an admin
      storage.save(alicesTeam)

      // Bob loads the team and tries to add Charlie as a member
      const bobsTeam = storage.load(bobsContext)
      const addUser = () => bobsTeam.add(redactUser(charlie))

      // Bob can't because Bob is not an admin
      expect(addUser).toThrow(/not an admin/)
    })

    it('does not allow a non-admin to remove a member', () => {
      // Alice creates a team and adds Bob and charlie
      const { team: alicesTeam } = setup()
      alicesTeam.add(redactUser(bob), []) // Bob is not an admin
      alicesTeam.add(redactUser(charlie), [])
      storage.save(alicesTeam)

      // Bob loads the team and tries to remove charlie
      const bobsTeam = storage.load(bobsContext)
      const remove = () => bobsTeam.remove(charlie.name)

      // Bob can't because Bob is not an admin
      expect(remove).toThrow(/not an admin/)
    })

    it('rotates keys when a member is removed from a role', () => {
      const { team: alicesTeam } = setup()
      alicesTeam.add(redactUser(bob), [ADMIN])

      // Alice's admin keys are generation 0
      expect(alicesTeam.adminKeys().generation).toBe(0)

      // Alice encrypts something for admins
      const message = 'i need you to take care of that thing'
      const encryptedMessage = alicesTeam.encrypt(message, { type: KeyType.ROLE, name: ADMIN })

      // Bob can read it
      // TODO

      // Bob sneakily makes a copy of his admin keys
      // TODO

      // Alice removes Bob's admin role
      alicesTeam.removeMemberRole('bob', ADMIN)

      // Bob can still read the old message (can't undisclose information you've disclosed)
      // TODO

      // Alice's admin keys are now generation 1
      expect(alicesTeam.adminKeys().generation).toBe(1)

      // Alice encrypts a new message for admins
      // TODO

      // Bob tries to read the new message with his old admin key
      // TODO
      // He can't because the admin keys have been rotated
      // TODO
    })
  })
})
