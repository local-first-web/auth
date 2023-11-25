import { pause } from 'util/testing/pause.js'
import { describe, expect, it } from 'vitest'
import { OrderedNetwork } from '../OrderedNetwork.js'

const timeout = 20

describe('OrderedNetwork', () => {
  const setup = () => {
    const service = new OrderedNetwork<TestMessage>({ timeout })
    const received: number[] = []
    const requested: number[] = []
    service
      .on('message', message => received.push(message.index))
      .on('request', index => requested.push(index))
    return { service, received, requested }
  }

  it('emits messages', () => {
    const { service, received } = setup()
    service.start()
    service.deliver({ index: 0 })
    service.deliver({ index: 1 })
    service.deliver({ index: 2 })
    expect(received).toEqual([0, 1, 2])
  })

  it('when messages are received out of order, emits them in order', () => {
    const { service, received } = setup()
    service
      .start()
      .deliver({ index: 0 })
      .deliver({ index: 2 }) // <- out of order
      .deliver({ index: 1 })
    expect(received).toEqual([0, 1, 2])
  })

  it('ignores duplicate messages', () => {
    const { service, received } = setup()
    service
      .start()
      .deliver({ index: 0 })
      .deliver({ index: 1 })
      .deliver({ index: 1 }) // <- duplicate
      .deliver({ index: 2 })
      .deliver({ index: 0 }) // <- duplicate
      .deliver({ index: 2 }) // <- duplicate
    expect(received).toEqual([0, 1, 2])
  })

  it('emits messages received before start', () => {
    const { service, received } = setup()

    // the service is not started yet
    service.deliver({ index: 0 })
    service.deliver({ index: 1 })
    service.deliver({ index: 2 })

    // Nothing is emitted
    expect(received).toEqual([])

    // once the service is started, messages are emitted in order
    service.start()
    expect(received).toEqual([0, 1, 2])
  })

  it('requests missing messages', async () => {
    const { service, received, requested } = setup()
    service.start()
    service.deliver({ index: 0 })
    // service.deliver({ index: 1 }) // <- missing
    // service.deliver({ index: 2 }) // <- missing
    service.deliver({ index: 3 })
    service.deliver({ index: 4 })

    // messages 3 & 4 are not emitted because 1 & 2 are missing
    expect(received).toEqual([0])

    // after a delay, the service requests a resend for the missing messages
    await pause(timeout * 2)
    expect(requested).toEqual([1, 2])

    // we respond with the missing messages
    service.deliver({ index: 1 })
    service.deliver({ index: 2 })

    // once the missing messages are received, they are emitted in order
    expect(received).toEqual([0, 1, 2, 3, 4])
  })

  it('cancels the request if the missing message is received before the timeout', async () => {
    const { service, received, requested } = setup()
    service.start()
    service.deliver({ index: 0 })
    // service.deliver({ index: 1 }) <- missing
    // service.deliver({ index: 2 }) <- missing
    service.deliver({ index: 3 })
    service.deliver({ index: 4 })

    // messages 3 & 4 are not emitted because 1 & 2 are missing
    expect(received).toEqual([0])

    // after a short delay, the missing messages arrive
    await pause(timeout / 2)
    service.deliver({ index: 1 })
    service.deliver({ index: 2 })

    // since the missing messages arrived within the delay, we don't request a resend
    expect(requested).toEqual([])

    // once the missing messages are received, they are emitted in order
    expect(received).toEqual([0, 1, 2, 3, 4])
  })

  it(`re-requests a message if it still doesn't come`, async () => {
    const { service, received, requested } = setup()
    service.start()
    service.deliver({ index: 0 })
    // service.deliver({ index: 1 }) <- missing
    service.deliver({ index: 2 })

    // after a delay, the service requests a resend for the missing message
    await pause(timeout * 2)
    expect(requested).toEqual([1])

    // a new message comes but we still don't have the missing message
    service.deliver({ index: 3 })

    // so we request it again
    await pause(timeout * 2)
    expect(requested).toEqual([1, 1])
  })

  it('does not deliver messages while stopped', async () => {
    const { service, received } = setup()
    service.start()
    service.deliver({ index: 0 })
    expect(received).toEqual([0])

    service.stop()
    service.deliver({ index: 1 })
    expect(received).toEqual([0])
  })

  it('can be restarted after being stopped', async () => {
    const { service, received } = setup()
    service.start()
    service.deliver({ index: 0 })
    expect(received).toEqual([0])

    service.stop()
    service.deliver({ index: 1 })
    expect(received).toEqual([0])

    service.start()
    service.deliver({ index: 2 })
    expect(received).toEqual([0, 1, 2])
  })
})

type TestMessage = {}
