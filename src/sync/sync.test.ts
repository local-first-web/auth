import { defaultContext, newTeamChain } from '/util/testing'
import { Team } from '/team'
import { sendHashes } from '/sync'

describe('sync', () => {
  const setup = () => {
    const context = defaultContext
    const team = new Team({ source: newTeamChain, context })
    return { team, context }
  }

  it('should send hashes', () => {
    const { team: aliceTeam } = setup()
    // @ts-ignore (chain is private)
    const message = sendHashes(aliceTeam.chain)
    expect(message.payload.hashes).toHaveLength(1)
    expect(message.payload.chainLength).toBe(1)
  })
})
