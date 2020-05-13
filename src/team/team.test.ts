import { Client, ContextWithSecrets, Device, DeviceType } from '../context'
import { deriveKeys, randomKey } from '../keys'
import { ADMIN } from '../role'
import { redactUser, UserWithSecrets } from '../user'
import { Team } from './team'

describe('Team', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const makeUser = (userName: string): UserWithSecrets => {
    const keys = deriveKeys(randomKey())
    return { userName, keys }
  }

  const alice = makeUser('alice')
  const bob = makeUser('bob')
  const charlie = makeUser('charlie')

  const device: Device = {
    name: 'windows laptop',
    type: DeviceType.laptop,
  }
  const client: Client = {
    name: 'test',
    version: '0',
  }

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

    it('throws when asked for a nonexistent member', () => {
      const { team } = setup()
      const findNonexistent = () => team.members('ned')
      expect(findNonexistent).toThrow(/member(.*)not found/i)
    })

    it('adds a member', () => {
      const { team } = setup()
      team.add(redactUser(bob))
      expect(team.members().length).toBe(2)
      expect(team.members('bob').userName).toBe('bob')
    })

    it('does not add a member that is already present', () => {
      const { team } = setup()
      team.add(redactUser(bob))

      // try adding bob again
      const addBobAgain = () => team.add(redactUser(bob))
      expect(addBobAgain).toThrow(/member(.*)already exists/i)
    })

    it('removes a member', () => {
      const { team } = setup()

      team.add(redactUser(bob))
      expect(team.has('bob')).toBe(true)

      team.remove('bob')
      expect(team.has('bob')).toBe(false)
    })

    it.todo('does not remove a member that is not already present')

    it.todo('rotates keys after removing a member')
    it.todo('adds a device')
    it.todo('removes a device')
    it.todo('rotates keys after removing a device')

    it.todo('automatically resolves concurrent edits')
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

    it.todo('adds a role')
    it.todo('adds a member to a role')
    it.todo('removes a member from a role')
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
    it.todo('encrypts content a specific member')
  })
})
