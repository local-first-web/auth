import { strongRemoveResolver } from '/team/strongRemoveResolver'
import * as chains from '/chain'
import { getSequence, merge } from '/chain'
import { TeamAction, TeamActionLink } from '/team/types'
import { redactUser } from '/user'
import { alice, bob, charlie, defaultContext } from '/util/testing'

describe('teams', () => {
  describe('strongRemoveResolver', () => {
    test('should resolve two ', () => {
      const localUser = alice

      // create a chain with a root element
      const root = { teamName: 'Spies Я Us', rootMember: redactUser(localUser) }
      const chain0 = chains.create<TeamAction>(root, defaultContext)

      // make two divergent chains

      const chain1a = chains.append(
        chain0,
        { type: 'ADD_MEMBER', payload: { member: redactUser(bob) } },
        defaultContext
      )

      const chain1b = chains.append(
        chain0,
        { type: 'ADD_MEMBER', payload: { member: redactUser(charlie) } },
        defaultContext
      )

      const chain2 = merge(chain1a, chain1b)

      // given the same chain, you'll always get the same result
      const sequence = getSequence({ chain: chain2, resolver: strongRemoveResolver })
      const sequence2 = getSequence({ chain: chain2, resolver: strongRemoveResolver })
      expect(sequence).toEqual(sequence2)

      // the result will be one of these two (could be either because timestamps change with each test run)
      const optionA = ['ROOT', 'ADD_MEMBER charlie', 'ADD_MEMBER bob']
      const optionB = ['ROOT', 'ADD_MEMBER bob', 'ADD_MEMBER charlie']
      expect([optionA, optionB]).toContainEqual(sequence.map(linkSummary))
    })
  })
})

const linkSummary = (l: TeamActionLink) => {
  const summary = l.body.type === 'ADD_MEMBER' ? l.body.payload.member.userName : ''
  return `${l.body.type} ${summary}`.trim()
}
