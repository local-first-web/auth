import { load } from '/team'
import { defaultContext, newTeam } from '/util/testing'
import { storage } from '/util/testing'

describe('Team', () => {
  beforeEach(() => {
    storage.contents = undefined
  })

  const setup = () => ({
    team: newTeam(),
    context: defaultContext,
  })

  describe('create', () => {
    it('returns a new team', () => {
      const { team } = setup()
      expect(team.teamName).toBe('Spies Я Us')
    })

    it('saves & loads', () => {
      const { team, context } = setup()
      const savedChain = team.save()
      const restoredTeam = load(savedChain, context)
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
