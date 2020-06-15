import { sendHashes } from '/sync'
import { defaultContext, newTeam } from '/util/testing'

describe('sync', () => {
  const setup = () => ({
    team: newTeam(),
    context: defaultContext,
  })

  it('should send hashes', () => {
    const { team: aliceTeam } = setup()
    // @ts-ignore (chain is private)
    const message = sendHashes(aliceTeam.chain)
    expect(message.payload.hashes).toHaveLength(1)
    expect(message.payload.chainLength).toBe(1)
  })
})
