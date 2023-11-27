import { TestChannel, all, connect, joinTestChannel, setup } from 'util/testing/index.js'
import { pause } from 'util/testing/pause.js'
import { describe, it } from 'vitest'

describe('connection', () => {
  it('should connect', async () => {
    const { alice, bob } = setup('alice', 'bob')

    // 👩🏾 👨🏻‍🦲 Alice and Bob both join the channel and connect
    await connect(alice, bob)
  })

  it('should connect even with a delayed start', async () => {
    const { alice, bob } = setup('alice', 'bob')

    const join = joinTestChannel(new TestChannel())

    const bobConnection = join(bob.connectionContext)
    const aliceConnection = join(alice.connectionContext)

    aliceConnection.start()
    await pause(100)
    bobConnection.start()

    await all([aliceConnection, bobConnection], 'connected')
  })
})
