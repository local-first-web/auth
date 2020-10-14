import { EncryptedEnvelope } from '/team/types'
import { symmetric } from '/crypto'
import { ADMIN } from '/role'
import { redact } from '/user'
import {
  bob,
  bobsContext,
  charlie,
  charliesContext,
  defaultContext,
  managers,
  MANAGERS,
  newTeam,
} from '/util/testing'
import { storage } from '/util/testing'

import '/util/testing/expect/toLookLikeKeyset'
import { Team } from '/team'

describe('Team', () => {
  const setup = () => {
    localStorage.clear()
    storage.contents = undefined

    return {
      team: new Team({ teamName: 'Spies Я Us', context: defaultContext }),
      context: defaultContext,
    }
  }

  describe('roles', () => {
    it('Alice is admin by default', () => {
      const { team } = setup()
      expect(team.memberIsAdmin('alice')).toBe(true)
    })

    it('Bob is not admin by default', () => {
      const { team } = setup()
      team.add(redact(bob))
      expect(team.memberIsAdmin('bob')).toBe(false)
    })

    it('adds a role', () => {
      const { team } = setup()
      expect(team.roles().map(r => r.roleName)).toEqual([ADMIN])
      expect(team.hasRole(ADMIN)).toBe(true)
      team.addRole(managers)
      expect(team.roles().map(r => r.roleName)).toEqual([ADMIN, MANAGERS])
      expect(team.roles(MANAGERS).roleName).toBe(MANAGERS)
      expect(team.hasRole(MANAGERS)).toBe(true)
    })

    it('admins have access to all role keys', () => {
      const { team } = setup()
      team.addRole(managers)

      // Alice is not a member of the managers role
      expect(team.memberHasRole('alice', MANAGERS)).toBe(false)

      // But Alice does have access to the managers' keys
      const managersKeys = team.roleKeys(MANAGERS)
      expect(managersKeys).toLookLikeKeyset()
    })

    it('adds a member to a role', () => {
      const { team: alicesTeam } = setup()
      alicesTeam.add(redact(bob))

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
      // @ts-ignore roleKeys is private
      const bobsAdminKeys = bobsTeam.roleKeys(ADMIN)
      expect(bobsAdminKeys).toLookLikeKeyset()
    })

    it('removes a member from a role', () => {
      const { team: alicesTeam } = setup()
      alicesTeam.add(redact(bob), [ADMIN])

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
      // @ts-ignore roleKeys is private
      const bobLooksForAdminKeys = () => bobsTeam.roleKeys(ADMIN)
      expect(bobLooksForAdminKeys).toThrow()
    })

    it.only('removes a role', () => {
      let chain1: string, chain2: string
      {
        const { team } = setup()
        chain1 = team.save()
        expect(team.roles().map(r => r.roleName)).toEqual([ADMIN])
        expect(team.hasRole(ADMIN)).toBe(true)
        team.addRole(managers)
        expect(team.roles().map(r => r.roleName)).toEqual([ADMIN, MANAGERS])
        expect(team.roles(MANAGERS).roleName).toBe(MANAGERS)
        expect(team.hasRole(MANAGERS)).toBe(true)
      }

      {
        const { team } = setup()
        chain2 = team.save()
        let allRoles = team.roles()
        team.addRole(managers)
        expect(team.roles().map(r => r.roleName)).toEqual([ADMIN, MANAGERS])
        expect(team.roles(MANAGERS).roleName).toBe(MANAGERS)

        team.removeRole(MANAGERS)
        expect(team.roles().length).toBe(1)
      }
    })

    it(`won't remove the admin role`, () => {
      const { team } = setup()
      const attemptToRemoveAdminRole = () => team.removeRole(ADMIN)
      expect(attemptToRemoveAdminRole).toThrow()
    })

    it('gets an individual role', () => {
      const { team } = setup()
      console.log(team.roles())
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

    it('lists all members in a role ', () => {
      const { team } = setup()
      team.add(redact(bob), [ADMIN])
      expect(team.membersInRole(ADMIN).map(m => m.userName)).toEqual(['alice', 'bob'])
    })

    it('allows an admin other than Alice to add a member', () => {
      // Alice creates a team and adds Bob as an admin
      const { team: alicesTeam } = setup()
      alicesTeam.add(redact(bob), [ADMIN]) // bob is an admin
      storage.save(alicesTeam)

      // Bob loads the team and adds Charlie as a member
      const bobsTeam = storage.load(bobsContext)
      const addUser = () => bobsTeam.add(redact(charlie))

      // Bob is allowed because he is an admin
      expect(addUser).not.toThrow()
    })

    it('does not allow a non-admin to add a member', () => {
      // Alice creates a team and adds Bob with no admin rights
      const { team: alicesTeam } = setup()
      alicesTeam.add(redact(bob), []) // Bob is not an admin
      storage.save(alicesTeam)

      // Bob loads the team and tries to add Charlie as a member
      const bobsTeam = storage.load(bobsContext)
      const addUser = () => bobsTeam.add(redact(charlie))

      // Bob can't because Bob is not an admin
      expect(addUser).toThrow(/not an admin/)
    })

    it('does not allow a non-admin to remove a member', () => {
      // Alice creates a team and adds Bob and Charlie
      const { team: alicesTeam } = setup()
      alicesTeam.add(redact(bob), []) // Bob is not an admin
      alicesTeam.add(redact(charlie), [])
      storage.save(alicesTeam)

      // Bob loads the team and tries to remove Charlie
      const bobsTeam = storage.load(bobsContext)
      const remove = () => bobsTeam.remove(charlie.userName)

      // Bob can't because Bob is not an admin
      expect(remove).toThrow(/not an admin/)
    })

    it('rotates keys when a member is removed from a role', () => {
      const COOLKIDS = 'coolkids'

      const { team: alicesTeam } = setup()
      alicesTeam.addRole({ roleName: COOLKIDS })
      alicesTeam.add(redact(bob), [COOLKIDS])
      alicesTeam.add(redact(charlie), [COOLKIDS])
      storage.save(alicesTeam)
      let bobsTeam = storage.load(bobsContext)
      let charliesTeam = storage.load(charliesContext)

      // Bob is currently in the cool kids
      expect(bobsTeam.memberHasRole('bob', COOLKIDS)).toBe(true)

      // The cool kids keys have never been rotated
      // @ts-ignore roleKeys is private
      expect(alicesTeam.roleKeys(COOLKIDS).generation).toBe(0)

      // Alice encrypts something for the cool kids
      const message = `exclusive admin-only party at Alice's house tonight`
      const encryptedMessage = alicesTeam.encrypt(message, COOLKIDS)

      // Bob and Charlie can both read the message
      expect(bobsTeam.decrypt(encryptedMessage)).toEqual(message)
      expect(charliesTeam.decrypt(encryptedMessage)).toEqual(message)

      // Now, Bob suspects no one likes him so he makes a copy of his keys
      // @ts-ignore roleKeys is private
      const copyOfKeysInCaseTheyKickMeOut = bobsTeam.roleKeys(COOLKIDS)

      // Sure enough, Alice remembers that she can't stand Bob so she kicks him out
      alicesTeam.removeMemberRole('bob', COOLKIDS)

      // Everyone gets the latest team state
      storage.save(alicesTeam)
      bobsTeam = storage.load(bobsContext)
      charliesTeam = storage.load(charliesContext)

      // Charlie can still read the message
      expect(charliesTeam.decrypt(encryptedMessage)).toEqual(message)

      // Bob can no longer read the message through normal channels
      expect(() => bobsTeam.decrypt(encryptedMessage)).toThrow()

      // But with a little effort...
      const decryptUsingSavedKey = (message: EncryptedEnvelope) => () =>
        symmetric.decrypt(message.contents, copyOfKeysInCaseTheyKickMeOut.secretKey)

      // Bob can still see the old message using his saved key, because it was encrypted before he
      // was kicked out (can't undisclose what you've disclosed)
      expect(decryptUsingSavedKey(encryptedMessage)).not.toThrow()

      // However! the group's keys have been rotated
      // @ts-ignore roleKeys is private
      expect(alicesTeam.roleKeys(COOLKIDS).generation).toBe(1)

      // So Alice encrypts a new message for admins
      const newMessage = `party moved to Charlie's place, don't tell Bob`
      const newEncryptedMessage = alicesTeam.encrypt(newMessage, COOLKIDS)

      // Charlie can read the message
      expect(charliesTeam.decrypt(newEncryptedMessage)).toEqual(newMessage)

      // Bob tries to read the new message with his old admin key, but he can't because it was
      // encrypted with the new key
      expect(decryptUsingSavedKey(newEncryptedMessage)).toThrow()
    })
  })
})
