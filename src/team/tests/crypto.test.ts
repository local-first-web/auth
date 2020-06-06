import { defaultContext, storage, teamChain } from './utils'
import { ADMIN_SCOPE, TEAM_SCOPE } from '/keys'
import { Team } from '/team'

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

  describe('crypto', () => {
    describe('encryption', () => {
      it('encrypts content for the team', () => {
        const { team } = setup()
        const message = 'I need you to take care of that thing'
        const encrypted = team.encrypt(message, TEAM_SCOPE)

        const decrypted = team.decrypt(encrypted)
        expect(decrypted).toEqual(message)
      })

      it('encrypts content for a role', () => {
        const { team } = setup()
        const message =
          'You know, the situation, that we talked about, I need you to take care of that'
        const encrypted = team.encrypt(message, ADMIN_SCOPE)

        const decrypted = team.decrypt(encrypted)
        expect(decrypted).toEqual(message)
      })
    })

    describe('signatures', () => {
      it('validates a signed message', () => {
        const { team } = setup()
        const message = 'That thing, I took care of it, boss'
        const signed = team.sign(message)

        expect(team.verify(signed)).toBe(true)
      })
    })
  })
})
