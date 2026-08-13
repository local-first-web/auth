import * as lockbox from 'lockbox/index.js'
import { ADMIN } from 'role/index.js'
import * as teams from 'team/index.js'
import { setup } from 'util/testing/index.js'
import 'util/testing/expect/toLookLikeKeyset.js'
import { symmetric } from '@localfirst/crypto'
import { describe, expect, it } from 'vitest'

const MANAGERS = 'managers'
const managers = { roleName: MANAGERS }

describe('Team', () => {
  describe('roles', () => {
    it('Alice is admin', () => {
      const { alice } = setup('alice')
      expect(alice.team.memberIsAdmin(alice.userId)).toBe(true)
    })

    it('Bob is not admin', () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: false })
      expect(alice.team.memberIsAdmin(bob.userId)).toBe(false)
    })

    it('Bob is admin', () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: true })
      expect(alice.team.memberIsAdmin(bob.userId)).toBe(true)
    })

    it('adds a role', () => {
      const { alice, bob } = setup('alice', 'bob')

      // We only have default roles to start out
      expect(alice.team.roles().map(r => r.roleName)).toEqual([ADMIN])
      expect(alice.team.hasRole(ADMIN)).toBe(true)
      expect(alice.team.hasRole(MANAGERS)).toBe(false)

      // 👩🏾 Alice adds the managers role
      alice.team.addRole(managers)
      expect(alice.team.roles().map(r => r.roleName)).toEqual([ADMIN, MANAGERS])
      expect(alice.team.roles(MANAGERS).roleName).toBe(MANAGERS)
      expect(alice.team.hasRole(MANAGERS)).toBe(true)

      // 👩🏾 Alice adds 👨🏻‍🦲 Bob to the managers role
      alice.team.addMemberRole(bob.userId, MANAGERS)
      expect(alice.team.membersInRole(MANAGERS).map(m => m.userName)).toEqual(['bob'])
    })

    it('admins have access to all role keys', () => {
      const { alice } = setup('alice')

      // 👩🏾 Alice adds the managers role
      alice.team.addRole(managers)

      // 👩🏾 Alice is not a member of the managers role
      expect(alice.team.memberHasRole(alice.userId, MANAGERS)).toBe(false)

      // But she does have access to the managers' keys
      const managersKeys = alice.team.roleKeys(MANAGERS)
      expect(managersKeys).toLookLikeKeyset()
    })

    it('adds a member to a role', () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: false })

      // 👨🏻‍🦲 Bob isn't an admin yet
      expect(alice.team.memberIsAdmin(bob.userId)).toBe(false)

      // 👩🏾 Alice makes 👨🏻‍🦲 Bob an admin
      alice.team.addMemberRole(bob.userId, ADMIN)

      // Now 👨🏻‍🦲 Bob is an admin
      expect(alice.team.memberIsAdmin(bob.userId)).toBe(true)

      // Alice persists the team
      const savedTeam = alice.team.save()

      // 👨🏻‍🦲 Bob loads the team
      bob.team = teams.load(savedTeam, bob.localContext, alice.team.teamKeys())

      // 👨🏻‍🦲 Bob has admin keys
      const bobsAdminKeys = bob.team.roleKeys(ADMIN)
      expect(bobsAdminKeys).toLookLikeKeyset()
    })

    it("won't add a member to a role without a lockbox holding that role's keys", () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: false })

      // 👩🏾 Alice authors the role grant herself, leaving out the lockbox. Applications gate on
      // `memberHasRole`, so without this check 👨🏻‍🦲 Bob would count as an admin everywhere while
      // holding none of the admin keys.
      const grantRoleWithNoLockbox = () => {
        alice.team.dispatch({
          type: 'ADD_MEMBER_ROLE',
          payload: { userId: bob.userId, roleName: ADMIN, lockboxes: [] },
        })
      }

      expect(grantRoleWithNoLockbox).toThrowError(/lockbox/i)
      expect(alice.team.memberIsAdmin(bob.userId)).toBe(false)
    })

    it("won't add a member to a role with a lockbox addressed to someone else", () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: false })

      // 👩🏾 Alice grants 👨🏻‍🦲 Bob the admin role, but addresses the lockbox to herself
      const lockboxForAlice = lockbox.create(
        alice.team.roleKeys(ADMIN),
        alice.team.members(alice.userId).keys
      )
      const grantRoleWithWrongLockbox = () => {
        alice.team.dispatch({
          type: 'ADD_MEMBER_ROLE',
          payload: { userId: bob.userId, roleName: ADMIN, lockboxes: [lockboxForAlice] },
        })
      }

      expect(grantRoleWithWrongLockbox).toThrowError(/lockbox/i)
      expect(alice.team.memberIsAdmin(bob.userId)).toBe(false)
    })

    it("won't add a member to a role with a lockbox holding a different role's keys", () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: false })
      alice.team.addRole(managers)

      // 👩🏾 Alice makes 👨🏻‍🦲 Bob an admin, but the lockbox only holds the managers' keys
      const lockboxForBob = lockbox.create(
        alice.team.roleKeys(MANAGERS),
        alice.team.members(bob.userId).keys
      )
      const grantRoleWithWrongKeys = () => {
        alice.team.dispatch({
          type: 'ADD_MEMBER_ROLE',
          payload: { userId: bob.userId, roleName: ADMIN, lockboxes: [lockboxForBob] },
        })
      }

      expect(grantRoleWithWrongKeys).toThrowError(/lockbox/i)
      expect(alice.team.memberIsAdmin(bob.userId)).toBe(false)
    })

    it('adds a member to a role when the lockbox is in order', () => {
      const { alice, bob } = setup('alice', { user: 'bob', admin: false })
      alice.team.addRole(managers)

      // 👩🏾 Alice grants roles the normal way, so the keys go along with them
      alice.team.addMemberRole(bob.userId, ADMIN)
      alice.team.addMemberRole(bob.userId, MANAGERS)

      // ✅ 👨🏻‍🦲 Bob has both roles, and the keys that come with them
      bob.team = teams.load(alice.team.save(), bob.localContext, alice.team.teamKeys())
      expect(bob.team.memberIsAdmin(bob.userId)).toBe(true)
      expect(bob.team.memberHasRole(bob.userId, MANAGERS)).toBe(true)
      expect(bob.team.roleKeys(ADMIN)).toLookLikeKeyset()
      expect(bob.team.roleKeys(MANAGERS)).toLookLikeKeyset()
    })

    it('removes a member from a role', () => {
      const { alice, bob } = setup('alice', 'bob')

      // Alice creates manager role and add 👨🏻‍🦲 Bob to it
      alice.team.addRole(managers)
      alice.team.addMemberRole(bob.userId, MANAGERS)

      // 👨🏻‍🦲 Bob is an admin
      expect(alice.team.memberIsAdmin(bob.userId)).toBe(true)

      // Alice removes 👨🏻‍🦲 Bob's admin role
      alice.team.removeMemberRole(bob.userId, ADMIN)

      // 👨🏻‍🦲 Bob is no longer an admin
      expect(alice.team.memberIsAdmin(bob.userId)).toBe(false)
      expect(alice.team.memberHasRole(bob.userId, MANAGERS)).toBe(true)

      // Alice persists the team
      const savedTeam = alice.team.save()

      // 👨🏻‍🦲 Bob loads the team
      bob.team = teams.load(savedTeam, bob.localContext, alice.team.teamKeys())

      // On his side, 👨🏻‍🦲 Bob can see that he is no longer an admin
      expect(bob.team.memberIsAdmin(bob.userId)).toBe(false)

      // 👨🏻‍🦲 Bob doesn't have admin keys any more
      const bobLooksForAdminKeys = () => bob.team.roleKeys(ADMIN)
      expect(bobLooksForAdminKeys).toThrow()
    })

    it('removes a role', () => {
      const { alice } = setup('alice')

      // 👩🏾 Alice adds the managers role
      alice.team.addRole(managers)
      expect(alice.team.roles().map(r => r.roleName)).toEqual([ADMIN, MANAGERS])
      expect(alice.team.roles(MANAGERS).roleName).toBe(MANAGERS)

      // 👩🏾 Alice removes the managers role
      alice.team.removeRole(MANAGERS)
      expect(alice.team.roles().length).toBe(1)
    })

    it("won't remove the admin role", () => {
      const { alice } = setup('alice')

      // 👩🏾 Alice tries to remove the admin role
      const attemptToRemoveAdminRole = () => {
        alice.team.removeRole(ADMIN)
      }

      // She can't because that would be ridiculous
      expect(attemptToRemoveAdminRole).toThrow()
    })

    it('gets an individual role', () => {
      const { alice } = setup('alice')
      const adminRole = alice.team.roles(ADMIN)
      expect(adminRole.roleName).toBe(ADMIN)
    })

    it('throws if asked to get a nonexistent role', () => {
      const { alice } = setup('alice')
      const getNonexistentRole = () => alice.team.roles('spatula')
      expect(getNonexistentRole).toThrow(/not found/)
    })

    it('lists all roles', () => {
      const { alice } = setup('alice')
      alice.team.addRole(managers)
      const roles = alice.team.roles()
      expect(roles).toHaveLength(2)
      expect(roles.map(role => role.roleName)).toEqual([ADMIN, MANAGERS])
    })

    it('lists all members in a role ', () => {
      const { alice } = setup('alice', { user: 'bob', admin: true })

      // 👩🏾 Alice and 👨🏻‍🦲 Bob are members
      expect(alice.team.membersInRole(ADMIN).map(m => m.userName)).toEqual(['alice', 'bob'])
      expect(alice.team.admins().map(m => m.userName)).toEqual(['alice', 'bob'])
    })

    it('allows an admin other than Alice to add a member', () => {
      const { bob, charlie } = setup(
        'alice',
        { user: 'bob', admin: true },
        { user: 'charlie', member: false }
      )

      // 👨🏻‍🦲 Bob tries to add 👳🏽‍♂️ Charlie to the team
      const attemptToAddUser = () => {
        bob.team.addForTesting(charlie.user)
      }

      // 👨🏻‍🦲 Bob is allowed because he is an admin
      expect(attemptToAddUser).not.toThrow()
    })

    it('does not allow a non-admin to add a member', () => {
      const { bob, charlie } = setup(
        'alice',
        { user: 'bob', admin: false },
        { user: 'charlie', member: false }
      )

      // 👨🏻‍🦲 Bob tries to add 👳🏽‍♂️ Charlie to the team
      const addUser = () => {
        bob.team.addForTesting(charlie.user)
      }

      // 👨🏻‍🦲 Bob can't because he is not an admin
      expect(addUser).toThrow()
    })

    it('does not allow a non-admin to remove a member', () => {
      const { bob } = setup(
        'alice',
        { user: 'bob', admin: false },
        { user: 'charlie', admin: false }
      )

      // 👨🏻‍🦲 Bob tries to remove 👳🏽‍♂️ Charlie
      const remove = () => {
        bob.team.remove('charlie')
      }

      // 👨🏻‍🦲 Bob can't because he is not an admin
      expect(remove).toThrow()
    })

    it('does not allow a non-admin to add a member to a role', () => {
      const { bob } = setup(
        'alice',
        { user: 'bob', admin: false },
        { user: 'charlie', admin: false }
      )

      // 👨🏻‍🦲 Bob tries to make 👳🏽‍♂️ Charlie an admin
      const add = () => {
        bob.team.addMemberRole('charlie', ADMIN)
      }

      // 👨🏻‍🦲 Bob can't because he is not an admin
      expect(add).toThrow()
    })

    it('does not allow a non-admin to remove a member from a role', () => {
      const { charlie } = setup('alice', 'bob', {
        user: 'charlie',
        admin: false,
      })

      // 👳🏽‍♂️ Charlie tries to remove 👨🏻‍🦲 Bob as admin
      const remove = () => {
        charlie.team.removeMemberRole('bob', ADMIN)
      }

      // 👳🏽‍♂️ Charlie can't because he is not an admin
      expect(remove).toThrow()
    })

    it("can't remove the only admin", () => {
      const { alice } = setup('alice', { user: 'bob', admin: false })

      const remove = () => {
        alice.team.removeMemberRole('alice', ADMIN)
      }

      expect(remove).toThrow()
    })

    it('Alice can remove herself as admin as long as there at least one other admin', () => {
      const { alice } = setup('alice', 'bob')

      const remove = () => {
        alice.team.removeMemberRole('alice', ADMIN)
      }

      expect(remove).not.toThrow()
    })

    it('rotates keys when a member is removed from a role', async () => {
      const COOLKIDS = 'coolkids'

      const { alice, bob, charlie } = setup(
        'alice',
        { user: 'bob', admin: false },
        { user: 'charlie', admin: false }
      )

      alice.team.addRole(COOLKIDS)
      alice.team.addMemberRole(bob.userId, COOLKIDS)
      alice.team.addMemberRole(charlie.userId, COOLKIDS)

      const keys = alice.team.teamKeys()

      const savedTeam = alice.team.save()
      bob.team = teams.load(savedTeam, bob.localContext, keys)
      charlie.team = teams.load(savedTeam, charlie.localContext, keys)

      // 👨🏻‍🦲 Bob is currently in the cool kids
      expect(bob.team.memberHasRole(bob.userId, COOLKIDS)).toBe(true)

      // The cool kids keys have never been rotated
      expect(alice.team.roleKeys(COOLKIDS).generation).toBe(0)

      // 👩🏾 Alice encrypts something for the cool kids
      const message = "exclusive party at Alice's house tonight. cool kids only!!!"
      const encryptedMessage = alice.team.encrypt(message, COOLKIDS)
      // 👨🏻‍🦲 Bob and Charlie can both read the message

      expect(bob.team.decrypt(encryptedMessage)).toEqual(message)
      expect(charlie.team.decrypt(encryptedMessage)).toEqual(message)

      // Now, 👨🏻‍🦲 Bob suspects no one likes him so he makes a copy of his keys
      const copyOfKeysInCaseTheyKickMeOut = bob.team.roleKeys(COOLKIDS)

      // Sure enough, 👩🏾 Alice remembers that she can't stand 👨🏻‍🦲 Bob so she kicks him out
      alice.team.removeMemberRole(bob.userId, COOLKIDS)

      // Everyone gets the latest team state
      const savedTeam2 = alice.team.save()
      bob.team = teams.load(savedTeam2, bob.localContext, alice.team.teamKeys())
      charlie.team = teams.load(savedTeam2, charlie.localContext, alice.team.teamKeys())

      // 👳🏽‍♂️ Charlie can still read the message
      expect(charlie.team.decrypt(encryptedMessage)).toEqual(message)

      // 👨🏻‍🦲 Bob can no longer read the message through normal channels
      expect(() => bob.team.decrypt(encryptedMessage)).toThrow()

      // But with a little effort...
      const decryptUsingSavedKey = (message: teams.EncryptedEnvelope) => () =>
        symmetric.decryptBytes(message.contents, copyOfKeysInCaseTheyKickMeOut.secretKey)

      // 👨🏻‍🦲 Bob can still see the old message using his saved key, because it was encrypted before he
      // was kicked out (can't undisclose what you've disclosed)
      expect(decryptUsingSavedKey(encryptedMessage)).not.toThrow()

      // However! the group's keys have been rotated
      expect(alice.team.roleKeys(COOLKIDS).generation).toBe(1)

      // So 👩🏾 Alice encrypts a new message for the cool kids
      const newMessage = "party moved to Charlie's place, don't tell Bob"
      const newEncryptedMessage = alice.team.encrypt(newMessage, COOLKIDS)

      // 👳🏽‍♂️ Charlie can read the message
      expect(charlie.team.decrypt(newEncryptedMessage)).toEqual(newMessage)

      // 👨🏻‍🦲 Bob tries to read the new message with his old admin key, but he can't because it was
      // encrypted with the new key
      expect(decryptUsingSavedKey(newEncryptedMessage)).toThrow()
    })
  })
})
