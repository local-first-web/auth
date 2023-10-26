import { describe, expect, it } from 'vitest'
import { connect, setup } from 'util/testing/index.js'

describe('connection', () => {
  describe('encryption', () => {
    it('allows Alice and Bob to send each other encrypted messages', async () =>
      // eslint-disable-next-line no-async-promise-executor
      new Promise<void>(async resolve => {
        const { alice, bob } = setup('alice', 'bob')
        // 👩🏾 👨🏻‍🦲 Alice and Bob both join the channel
        await connect(alice, bob)

        // 👨🏻‍🦲 Bob sets up his message handler
        bob.connection[alice.deviceId].once('message', receiveMessage)

        // 👩🏾 Alice sends a message
        alice.connection[bob.deviceId].send('hello')

        // 👨🏻‍🦲 Bob receives it
        function receiveMessage(d: unknown) {
          expect(d).toEqual('hello')
          resolve()
        }
      }))
  })
})
