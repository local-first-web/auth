import {
  defaultContext,
  storage,
  newTeamChain,
  bobsContext,
  bob,
  charlie,
  charliesContext,
} from '/team/tests/utils'
import { ADMIN } from '/role'
import { Team } from '/team'

describe('Team', () => {
  beforeEach(() => {
    storage.contents = undefined
  })

  const setup = () => {
    const context = defaultContext
    const team = new Team({ source: newTeamChain, context })
    return { team, context }
  }

  describe('crypto', () => {
    describe('encryption', () => {
      it('encrypts content for the team', () => {
        const { team: alicesTeam } = setup()
        alicesTeam.add(bob)
        storage.save(alicesTeam)

        // Alice encrypts a message for the whole team
        const message = 'I need someone to take care of that thing'
        const encrypted = alicesTeam.encrypt(message)

        // Bob decrypts the message
        const bobsTeam = storage.load(bobsContext)
        const decrypted = bobsTeam.decrypt(encrypted)
        expect(decrypted).toEqual(message)
      })

      it('encrypts content for a role', () => {
        const { team: alicesTeam } = setup()
        alicesTeam.add(bob, [ADMIN]) // Bob is an admin
        alicesTeam.add(charlie) // Charlie is not an admin

        storage.save(alicesTeam)

        // Alice encrypts a message for the admin users
        const message = 'You know, the situation, I need that taken care of'
        const encrypted = alicesTeam.encrypt(message, ADMIN)

        // Bob can decrypt the message because he is an admin
        const bobsTeam = storage.load(bobsContext)
        const decrypted = bobsTeam.decrypt(encrypted)
        expect(decrypted).toEqual(message)

        // Charlie can't decrypt the message because he is not an admin
        const charliesTeam = storage.load(charliesContext)
        expect(() => charliesTeam.decrypt(encrypted)).toThrow()
      })
    })

    describe('signatures', () => {
      it('validates a signed message', () => {
        const { team: alicesTeam } = setup()
        alicesTeam.add(bob)
        storage.save(alicesTeam)

        // Bob signs a message
        const bobsTeam = storage.load(bobsContext)
        const message = 'That thing, I took care of it, boss'
        const signed = bobsTeam.sign(message)

        // Alice verifies that it was signed by Bob
        expect(signed.author.name).toBe('bob')
        expect(alicesTeam.verify(signed)).toBe(true)
      })
    })
  })
})
