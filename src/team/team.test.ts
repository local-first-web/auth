import { Client, ContextWithSecrets, Device, DeviceType } from '/context'
import { deriveKeys, randomKey } from '/keys'
import { ADMIN, Role } from '/role'
import { redactUser, UserWithSecrets } from '/user'
import { Team } from './team'

describe('Team', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const setup = (user = alice) => {
    const context: ContextWithSecrets = { user, device, client }
    const team = new Team({ teamName: 'Spies Я Us', context })
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
      const { team, context } = setup()
      const savedChain = team.save()
      const tamperedChain = savedChain.replace(/alice/gi, 'eve')
      const restoreTampered = () =>
        new Team({ source: JSON.parse(tamperedChain), context })
      expect(restoreTampered).toThrow(/signature(.*)not valid/i)
    })
  })

  describe('members', () => {
    it('has a root member', () => {
      const { team } = setup()
      expect(team.members().length).toBe(1)
      const alice = team.members('alice')
      expect(alice.userName).toBe('alice')
    })

    it('adds a member', () => {
      const { team } = setup()
      team.add(redactUser(bob))
      expect(team.members().length).toBe(2)
      expect(team.members('bob').userName).toBe('bob')
    })

    it('does not add a member that is already present', () => {
      const { team } = setup()
      const addBob = () => team.add(redactUser(bob))
      expect(addBob).not.toThrow()

      // try adding bob again
      const addBobAgain = () => team.add(redactUser(bob))
      expect(addBobAgain).toThrow(/already a member/i)
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
      expect(removeBob).toThrow(/there is no member/i)
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
      expect(getNed).toThrow(/member(.*)not found/i)
    })

    it('lists all members', () => {
      const { team } = setup()

      expect(team.members()).toHaveLength(1)
      expect(team.members().map(m => m.userName)).toEqual(['alice'])

      team.add(redactUser(bob))
      team.add(redactUser(charlie))
      expect(team.members()).toHaveLength(3)
      expect(team.members().map(m => m.userName)).toEqual([
        'alice',
        'bob',
        'charlie',
      ])
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
    it('alice is admin', () => {
      const { team } = setup()
      expect(team.memberIsAdmin('alice')).toBe(true)
    })

    it('bob is not admin', () => {
      const { team } = setup()
      team.add(redactUser(bob))
      expect(team.memberIsAdmin('bob')).toBe(false)
    })

    it('adds a role', () => {
      const { team } = setup()
      team.addRole(managers)
      expect(team.roles().length).toBe(2)
      expect(team.roles('managers').roleName).toBe(managers.roleName)
    })

    it.todo('adds a member to a role')
    it.todo('removes a member from a role')

    it('gets an individual role', () => {})

    it('allows an admin other than alice to add a member', () => {
      // get alice's team in JSON form
      const getTeamJson = () => {
        const { team } = setup()
        team.add(redactUser(bob), [ADMIN]) // bob is an admin
        return team.save()
      }

      // rehydrate the team on bob's device
      const source = JSON.parse(getTeamJson())
      const context: ContextWithSecrets = { user: bob, device, client }
      const team = new Team({ source, context })

      // bob tries to add a user
      const addUser = () => team.add(redactUser(charlie))
      // bob is allowed because he is an admin
      expect(addUser).not.toThrow()
    })

    it('does not allow a non-admin to add a member', () => {
      // get alice's team in JSON form
      const getTeamJson = () => {
        const { team } = setup()
        team.add(redactUser(bob), []) // bob is not an admin
        return team.save()
      }

      // rehydrate the team on bob's device
      const source = JSON.parse(getTeamJson())
      const context: ContextWithSecrets = { user: bob, device, client }
      const team = new Team({ source, context })

      // bob tries to add charlie as a member
      const addUser = () => team.add(redactUser(charlie))
      // bob can't because bob is not an admin
      expect(addUser).toThrow()
    })

    it('does not allow a non-admin to remove a member', () => {
      // get alice's team in JSON form
      const getTeamJson = () => {
        const { team } = setup()
        team.add(redactUser(bob), []) // bob is not an admin
        team.add(redactUser(charlie), [])
        return team.save()
      }

      // rehydrate the team on bob's device
      const source = JSON.parse(getTeamJson())
      const context: ContextWithSecrets = { user: bob, device, client }
      const team = new Team({ source, context })

      // bob tries to remove charlie
      const remove = () => team.add(redactUser(charlie))
      // bob can't because bob is not an admin
      expect(remove).toThrow()
    })

    it.todo('throws if asked to get a nonexistent role')
    it.todo('lists all roles')

    it.todo('rotates keys after removing a member from a role')
  })

  describe('invitations', () => {
    // alice issues the invitation (sends code via whatsapp)
    // bob presents invitation (clicks link)
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

const makeUser = (userName: string): UserWithSecrets => {
  const keys = deriveKeys(randomKey())
  return { userName, keys }
}

const alice = makeUser('alice')
const bob = makeUser('bob')
const charlie = makeUser('charlie')
const managers: Role = { roleName: 'managers' }

const device: Device = {
  name: 'windows laptop',
  type: DeviceType.laptop,
}

const client: Client = {
  name: 'test',
  version: '0',
}
