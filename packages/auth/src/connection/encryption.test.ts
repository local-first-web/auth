import { debug } from '@/util'
import { connect, setup } from '@/util/testing'

const log = debug('lf:auth:test')

describe('connection', () => {
  describe('encryption', () => {
    it('allows Alice and Bob to send each other encrypted messages', async done => {
      const { alice, bob } = setup('alice', 'bob')

      // 👩🏾 👨🏻‍🦲 Alice and Bob both join the channel
      await connect(alice, bob)

      // 👨🏻‍🦲 Bob sets up his message handler
      bob.connection.alice.once('message', receiveMessage)

      // 👩🏾 Alice sends a message
      alice.connection.bob.send('hello')

      // 👨🏻‍🦲 Bob receives it
      function receiveMessage(d: string) {
        expect(d).toEqual('hello')
        done()
      }
    })
  })
})
