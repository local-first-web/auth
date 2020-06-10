import { defaultContext, storage, newTeamChain } from '/util/testing'
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
      // 👩🏾 Alice creates and persists a team
      const { team, context } = setup()
      storage.save(team)

      // 🦹‍♀️ Eve tampers with the team in storage, replacing Alice's name with hers
      storage.contents = storage.contents!.replace(/alice/gi, 'eve')

      // 👩🏾 Alice reloads the team and is not fooled
      const restoreTampered = () => storage.load(context)
      expect(restoreTampered).toThrow(/not valid/)
    })
  })
})
