import { symmetric } from '@herbcaudill/crypto'
import { ADMIN } from '/role'
import * as teams from '/team'
import { setup } from '/util/testing'
import '/util/testing/expect/toLookLikeKeyset'

const MANAGERS = 'managers'
const managers = { roleName: MANAGERS }

describe('Team', () => {
  describe('roles', () => {
    it('Alice is admin by default', () => {
      const { alice } = setup(['alice'])
      expect(alice.team.memberIsAdmin('alice')).toBe(true)
    })

    it('Bob is not admin by default', () => {
      const { alice, bob } = setup(['alice', { user: 'bob', member: false }])
      alice.team.add(bob.user)
      expect(alice.team.memberIsAdmin('bob')).toBe(false)
    })

    it('adds a role', () => {
      const { alice } = setup(['alice', 'bob'])

      // only default roles to start out
      expect(alice.team.roles().map((r) => r.roleName)).toEqual([ADMIN])
      expect(alice.team.hasRole(ADMIN)).toBe(true)
      expect(alice.team.hasRole(MANAGERS)).toBe(false)

      // add managers
      alice.team.addRole(managers)
      expect(alice.team.roles().map((r) => r.roleName)).toEqual([ADMIN, MANAGERS])
      expect(alice.team.roles(MANAGERS).roleName).toBe(MANAGERS)
      expect(alice.team.hasRole(MANAGERS)).toBe(true)

      // add bob to managers
      alice.team.addMemberRole('bob', MANAGERS)
      expect(alice.team.membersInRole(MANAGERS).map((m) => m.userName)).toEqual(['bob'])
    })

    it('admins have access to all role keys', () => {
      const { alice } = setup(['alice'])
      alice.team.addRole(managers)

      // Alice is not a member of the managers role
      expect(alice.team.memberHasRole('alice', MANAGERS)).toBe(false)

      // But Alice does have access to the managers' keys
      const managersKeys = alice.team.roleKeys(MANAGERS)
      expect(managersKeys).toLookLikeKeyset()
    })

    it('adds a member to a role', () => {
      const { alice, bob } = setup(['alice', { user: 'bob', admin: false }])

      // Bob isn't an admin yet
      expect(alice.team.memberIsAdmin('bob')).toBe(false)

      alice.team.addMemberRole('bob', ADMIN)

      // Now Bob is an admin
      expect(alice.team.memberIsAdmin('bob')).toBe(true)

      // Alice persists the team
      const savedTeam = alice.team.save()

      // Bob loads the team
      bob.team = teams.load(savedTeam, bob.localContext)

      // Bob has admin keys
      const bobsAdminKeys = bob.team.roleKeys(ADMIN)
      expect(bobsAdminKeys).toLookLikeKeyset()
    })

    it('removes a member from a role', () => {
      const { alice, bob } = setup(['alice', 'bob'])

      // Alice creates manager role and add Bob to it
      alice.team.addRole(managers)
      alice.team.addMemberRole('bob', MANAGERS)

      // Bob is an admin
      expect(alice.team.memberIsAdmin('bob')).toBe(true)

      // Alice removes Bob's admin role
      alice.team.removeMemberRole('bob', ADMIN)

      // Bob is no longer an admin
      expect(alice.team.memberIsAdmin('bob')).toBe(false)
      expect(alice.team.memberHasRole('bob', MANAGERS)).toBe(true)

      // Alice persists the team
      const savedTeam = alice.team.save()

      // Bob loads the team
      bob.team = teams.load(savedTeam, bob.localContext)

      // On his side, Bob can see that he is no longer an admin
      expect(bob.team.memberIsAdmin('bob')).toBe(false)

      // Bob doesn't have admin keys any more
      const bobLooksForAdminKeys = () => bob.team.roleKeys(ADMIN)
      expect(bobLooksForAdminKeys).toThrow()
    })

    it('removes a role', () => {
      const { alice } = setup(['alice'])
      alice.team.addRole(managers)
      expect(alice.team.roles().map((r) => r.roleName)).toEqual([ADMIN, MANAGERS])
      expect(alice.team.roles(MANAGERS).roleName).toBe(MANAGERS)

      alice.team.removeRole(MANAGERS)
      expect(alice.team.roles().length).toBe(1)
    })

    it(`won't remove the admin role`, () => {
      const { alice } = setup(['alice'])
      const attemptToRemoveAdminRole = () => alice.team.removeRole(ADMIN)
      expect(attemptToRemoveAdminRole).toThrow()
    })

    it('gets an individual role', () => {
      const { alice } = setup(['alice'])
      const adminRole = alice.team.roles(ADMIN)
      expect(adminRole.roleName).toBe(ADMIN)
    })

    it('throws if asked to get a nonexistent role', () => {
      const { alice } = setup(['alice'])
      const getNonexistentRole = () => alice.team.roles('spatula')
      expect(getNonexistentRole).toThrow(/not found/)
    })

    it('lists all roles', () => {
      const { alice } = setup(['alice'])
      alice.team.addRole(managers)
      const roles = alice.team.roles()
      expect(roles).toHaveLength(2)
      expect(roles.map((role) => role.roleName)).toEqual([ADMIN, MANAGERS])
    })

    it('lists all members in a role ', () => {
      const { alice } = setup(['alice', { user: 'bob', admin: true }])
      expect(alice.team.membersInRole(ADMIN).map((m) => m.userName)).toEqual(['alice', 'bob'])
      expect(alice.team.admins().map((m) => m.userName)).toEqual(['alice', 'bob'])
    })

    it('allows an admin other than Alice to add a member', () => {
      // Alice creates a team and adds Bob as an admin
      const { bob, charlie } = setup([
        'alice',
        { user: 'bob', admin: true },
        { user: 'charlie', member: false },
      ])

      const attemptToAddUser = () => bob.team.add(charlie.user)

      // Bob is allowed because he is an admin
      expect(attemptToAddUser).not.toThrow()
    })

    it('does not allow a non-admin to add a member', () => {
      // Alice creates a team and adds Bob with no admin rights
      const { bob, charlie } = setup([
        'alice',
        { user: 'bob', admin: false },
        { user: 'charlie', member: false },
      ])

      // Bob tries to add Charlie as a member
      const addUser = () => bob.team.add(charlie.user)

      // Bob can't because Bob is not an admin
      expect(addUser).toThrow(/not an admin/)
    })

    it('does not allow a non-admin to remove a member', () => {
      // Alice creates a team and adds Bob and Charlie
      const { bob } = setup([
        'alice',
        { user: 'bob', admin: false },
        { user: 'charlie', admin: false },
      ])

      // Bob tries to remove Charlie
      const remove = () => bob.team.remove('charlie')

      // Bob can't because Bob is not an admin
      expect(remove).toThrow(/not an admin/)
    })

    it('rotates keys when a member is removed from a role', () => {
      const COOLKIDS = 'coolkids'

      const { alice, bob, charlie } = setup([
        'alice',
        { user: 'bob', member: false },
        { user: 'charlie', member: false },
      ])

      alice.team.addRole(COOLKIDS)
      alice.team.add(bob.user, [COOLKIDS])
      alice.team.add(charlie.user, [COOLKIDS])

      const savedTeam = alice.team.save()

      bob.team = teams.load(savedTeam, bob.localContext)
      charlie.team = teams.load(savedTeam, charlie.localContext)

      // Bob is currently in the cool kids
      expect(bob.team.memberHasRole('bob', COOLKIDS)).toBe(true)

      // The cool kids keys have never been rotated
      expect(alice.team.roleKeys(COOLKIDS).generation).toBe(0)

      // Alice encrypts something for the cool kids
      const message = `exclusive admin-only party at Alice's house tonight`
      const encryptedMessage = alice.team.encrypt(message, COOLKIDS)

      // Bob and Charlie can both read the message
      expect(bob.team.decrypt(encryptedMessage)).toEqual(message)
      expect(charlie.team.decrypt(encryptedMessage)).toEqual(message)

      // Now, Bob suspects no one likes him so he makes a copy of his keys
      const copyOfKeysInCaseTheyKickMeOut = bob.team.roleKeys(COOLKIDS)

      // Sure enough, Alice remembers that she can't stand Bob so she kicks him out
      alice.team.removeMemberRole('bob', COOLKIDS)

      // Everyone gets the latest team state
      const savedTeam2 = alice.team.save()
      bob.team = teams.load(savedTeam2, bob.localContext)
      charlie.team = teams.load(savedTeam2, charlie.localContext)

      // Charlie can still read the message
      expect(charlie.team.decrypt(encryptedMessage)).toEqual(message)

      // Bob can no longer read the message through normal channels
      expect(() => bob.team.decrypt(encryptedMessage)).toThrow()

      // But with a little effort...
      const decryptUsingSavedKey = (message: teams.EncryptedEnvelope) => () =>
        symmetric.decrypt(message.contents, copyOfKeysInCaseTheyKickMeOut.secretKey)

      // Bob can still see the old message using his saved key, because it was encrypted before he
      // was kicked out (can't undisclose what you've disclosed)
      expect(decryptUsingSavedKey(encryptedMessage)).not.toThrow()

      // However! the group's keys have been rotated
      expect(alice.team.roleKeys(COOLKIDS).generation).toBe(1)

      // So Alice encrypts a new message for admins
      const newMessage = `party moved to Charlie's place, don't tell Bob`
      const newEncryptedMessage = alice.team.encrypt(newMessage, COOLKIDS)

      // Charlie can read the message
      expect(charlie.team.decrypt(newEncryptedMessage)).toEqual(newMessage)

      // Bob tries to read the new message with his old admin key, but he can't because it was
      // encrypted with the new key
      expect(decryptUsingSavedKey(newEncryptedMessage)).toThrow()
    })
  })
})
