import {
  logMessages,
  NetworkMessage,
  setupWithNetwork as setup,
  UserStuffWithPeer as UserStuff,
} from '@/util/testing'

describe('sync', () => {
  it('one change', () => {
    const [{ alice, bob }, network] = setup('alice', 'bob')
    network.connect(alice.peer, bob.peer)

    // no changes yet; Alice and Bob are synced up
    expectToBeSynced(alice, bob)

    // Alice makes a change; now they are out of sync
    alice.team.addRole('managers')
    expectNotToBeSynced(alice, bob)

    // Alice exchanges sync messages with Bob
    alice.peer.sync()
    network.deliverAll()

    // Now they are synced up again
    expectToBeSynced(alice, bob)
  })

  it('lots of changes', () => {
    const [{ alice, bob }, network] = setup('alice', 'bob')
    network.connect(alice.peer, bob.peer)

    // no changes yet; Alice and Bob are synced up
    expectToBeSynced(alice, bob)

    // Alice makes many changes; now they are out of sync
    for (let i = 0; i < 10; i++) {
      alice.team.addRole(`role-${i}`)
    }
    expectNotToBeSynced(alice, bob)

    // Alice exchanges sync messages with Bob
    alice.peer.sync()
    const msgs = network.deliverAll()

    // Now they are synced up again
    expectToBeSynced(alice, bob)
  })

  it('many changes followed by a single change', () => {
    const [{ alice, bob }, network] = setup('alice', 'bob')
    network.connect(alice.peer, bob.peer)

    // Alice makes many changes
    const N = 10
    for (let i = 0; i < N; i++) {
      alice.team.addRole(`role-${i}`)
    }
    alice.peer.sync()
    const msgs1 = network.deliverAll()
    expect(countLinks(msgs1)).toEqual(10)

    // they're synced up again
    expectToBeSynced(alice, bob)

    // Alice makes one more change
    alice.team.addRole(`one-more-role`)
    alice.peer.sync()

    // make sure we didn't send more information that we had to
    const msgs2 = network.deliverAll()
    expect(countLinks(msgs2)).toEqual(1)

    expectToBeSynced(alice, bob)
  })

  it('concurrent changes', () => {
    const [{ alice, bob }, network] = setup('alice', 'bob')
    network.connect(alice.peer, bob.peer)

    // no changes yet; Alice and Bob are synced up
    expectToBeSynced(alice, bob)

    // Alice and Bob both make changes; now they are out of sync
    alice.team.addRole('alices-friends')
    bob.team.addRole('bobs-friends')
    expectNotToBeSynced(alice, bob)

    // Alice exchanges sync messages with Bob
    alice.peer.sync()
    network.deliverAll()

    // Now they are synced up again
    expectToBeSynced(alice, bob)
  })
})

const expectToBeSynced = (a: UserStuff, b: UserStuff) => {
  expect(a.team.chain.head).toEqual(b.team.chain.head)
}

const expectNotToBeSynced = (a: UserStuff, b: UserStuff) => {
  expect(a.team.chain.head).not.toEqual(b.team.chain.head)
}

const countLinks = (messages: NetworkMessage[]) => {
  const linkCount = (message: NetworkMessage) =>
    message.body.links ? Object.keys(message.body.links).length : 0

  return messages.reduce((result, message) => result + linkCount(message), 0)
}
