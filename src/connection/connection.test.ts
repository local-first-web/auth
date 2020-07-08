import { connectionMachine } from './connection'
import { interpret } from 'xstate'

describe('connection', () => {
  const setup = () => {
    const connectionService = interpret(connectionMachine).start()
    return { connectionService }
  }

  it('should work', () => {
    const { connectionService } = setup()

    // closed at beginning
    expect(connectionService.state.value).toEqual('disconnected')

    connectionService.send('CONNECT')
    expect(connectionService.state.value).toEqual({
      connecting: {
        claimingIdentity: 'awaitingChallenge',
        verifyingIdentity: 'awaitingClaim',
      },
    })
  })
})
