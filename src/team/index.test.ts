import { Client, ContextWithSecrets, Device, DeviceType } from '/context'
import { deriveKeys, randomKey } from '/keys'
import { ADMIN, Role } from '/role'
import { Team } from '/team'
import { redactUser, UserWithSecrets } from '/user'
import { LockboxScope } from '/lockbox'

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

  describe('create', () => {
    it('returns a new team', () => {
      const { team } = setup()
      expect(team.teamName).toBe('Spies Я Us')
    })

    it('saves & loads', () => {
      const { team, context } = setup()
      const savedChain = team.save()
      const restoredTeam = new Team({ source: JSON.parse(savedChain), context })
      expect(restoredTeam.teamName).toBe('Spies Я Us')
    })

    it('throws if saved chain is tampered with', () => {
      // Alice creates and persists a team
      const { team, context } = setup()
      storage.save(team)

      // Eve tampers with the team in storage
      storage.contents = storage.contents!.replace(/alice/gi, 'eve')

      // Alice reloads the team and is not fooled
      const restoreTampered = () => storage.load(context)
      expect(restoreTampered).toThrow(/not valid/)
    })
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
      expectToLookLikeKeyset(adminKeyset)

      const teamKeys = team.teamKeys
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
      const teamKeys = bobsTeam.teamKeys
      expectToLookLikeKeyset(teamKeys)

      // Bob is not an admin so he doesn't have admin keys
      const adminKeyset = bobsTeam.roleKeys(ADMIN)
      expect(adminKeyset).toBeUndefined()
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

    it('does not remove a member that is not already present', () => {
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

      const getBob = () => team.members('bob')
      expect(getBob).not.toThrow()
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

  describe('devices', () => {
    it.todo('adds a device')
    it.todo('removes a device')
    it.todo('rotates keys after removing a device')
  })

  describe('roles', () => {
    it('Alice is admin by default', () => {
      const { team } = setup()
      expect(team.memberIsAdmin('alice')).toBe(true)
    })

    it('bob is not admin by default', () => {
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

    it('creates lockboxes for existing admins when creating a role', () => {
      const { team } = setup()
      team.addRole(managers)

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

      alicesTeam.removeMemberRole('bob', ADMIN)

      // Bob is no longer an admin
      expect(alicesTeam.memberIsAdmin('bob')).toBe(false)

      // Alice persists the team
      storage.save(alicesTeam)

      // Bob loads the team
      const bobsTeam = storage.load(bobsContext)

      // Bob doesn't have admin keys any more
      const bobsAdminKeys = bobsTeam.roleKeys(ADMIN)
      expect(bobsAdminKeys).toBeUndefined()
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
      const remove = () => bobsTeam.add(redactUser(charlie))

      // Bob can't because Bob is not an admin
      expect(remove).toThrow(/not an admin/)
    })

    it.todo('rotates keys after removing a member from a role')
  })

  describe('invitations', () => {
    // Alice issues the invitation (sends code via whatsapp)
    // Bob presents invitation (clicks link)
    // presents? accepts?
    // charlie (not an admin) consummates the invitation
    // consummates? completes? accepts?

    it.todo('generates an invitation')
    it.todo('accepts valid proof of invitation')
    it.todo('rejects invalid proof of invitation')
    it.todo('only allows an invitation to be used once ')
    it.todo('does not allow another admin to hijack an invitation')
  })

  describe('crypto', () => {
    it.todo('encrypts content for the team')
    it.todo('encrypts content for a role')
    it.todo('encrypts content for a specific member')
    it.todo(`after charlie is removed, he can't read encrypted team content`)
  })
})

// UTILS

const expectToLookLikeKeyset = (maybeKeyset: any) => {
  expect(maybeKeyset).toHaveProperty('asymmetric')
  expect(maybeKeyset).toHaveProperty('symmetric')
  expect(maybeKeyset).toHaveProperty('signature')
}

const makeUser = (userName: string): UserWithSecrets => {
  const keys = deriveKeys(randomKey())
  return { userName, keys }
}

// A simple little storage emulator
const storage = {
  contents: undefined as string | undefined,
  save: (team: Team) => {
    storage.contents = team.save()
  },
  load: (context: ContextWithSecrets) => {
    if (storage.contents === undefined) throw new Error('need to save before you can load')
    return new Team({ source: JSON.parse(storage.contents), context })
  },
}

const alice = makeUser('alice')
const bob = makeUser('bob')
const charlie = makeUser('charlie')
const MANAGERS = 'managers'
const managers: Role = { roleName: MANAGERS }

const device: Device = {
  name: 'windows laptop',
  type: DeviceType.laptop,
}

const client: Client = {
  name: 'test',
  version: '0',
}

const alicesContext: ContextWithSecrets = { user: alice, device, client }
const bobsContext: ContextWithSecrets = { user: bob, device, client }
const defaultContext = alicesContext

const teamChain = JSON.parse(new Team({ teamName: 'Spies Я Us', context: defaultContext }).save())
