import { load } from '/Team'
import { setup } from '/util/testing'

describe('Team', () => {
  describe('create', () => {
    it('returns a new team', () => {
      const { alice } = setup(['alice'])
      expect(alice.team.teamName).toBe('Spies Я Us')
    })

    it('saves & loads', () => {
      const { alice } = setup(['alice'])
      const savedChain = alice.team.save()
      const restoredTeam = load(savedChain, alice.localContext)
      expect(restoredTeam.teamName).toBe('Spies Я Us')
    })

    it('throws if saved chain is tampered with', () => {
      // 👩🏾 Alice creates and persists a team
      const { alice } = setup(['alice'])
      let savedChain = alice.team.save()

      // 🦹‍♀️ Eve tampers with the team in storage, replacing Alice's name with hers
      savedChain = savedChain.replace(/alice/gi, 'eve')

      // 👩🏾 Alice reloads the team and is not fooled
      const restoreTampered = () => load(savedChain, alice.localContext)
      expect(restoreTampered).toThrow(/not valid/)
    })
  })
})
