import { getHashes } from '@/chain/testUtils'
import { truncateHashes } from '@/util'
import {
  MessageMutator,
  NetworkMessage,
  setupWithNetwork as setup,
  UserStuffWithPeer as UserStuff,
} from '@/util/testing'

describe('sync', () => {
  const N = 10 // "many"

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

  it('many changes', () => {
    const [{ alice, bob }, network] = setup('alice', 'bob')
    network.connect(alice.peer, bob.peer)

    // no changes yet; Alice and Bob are synced up
    expectToBeSynced(alice, bob)

    // Alice makes many changes; now they are out of sync
    for (let i = 0; i < N; i++) {
      alice.team.addRole(`role-${i}`)
    }
    expectNotToBeSynced(alice, bob)

    // Alice exchanges sync messages with Bob
    alice.peer.sync()
    const msgs = network.deliverAll()

    expect(msgs.length).toBeLessThanOrEqual(5)
    expect(countLinks(msgs)).toEqual(N)

    // Now they are synced up again
    expectToBeSynced(alice, bob)
  })

  it('many changes followed by a single change', () => {
    const [{ alice, bob }, network] = setup('alice', 'bob')
    network.connect(alice.peer, bob.peer)

    // Alice makes many changes
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
    bob.peer.sync()
    network.deliverAll()

    // Now they are synced up again
    expectToBeSynced(alice, bob)
  })

  it('many concurrent changes', () => {
    const [{ alice, bob }, network] = setup('alice', 'bob')
    network.connect(alice.peer, bob.peer)

    for (let i = 0; i < N; i++) {
      alice.team.addRole(`role-${i}`)
    }
    alice.peer.sync()
    bob.peer.sync()
    network.deliverAll()

    // no changes yet; Alice and Bob are synced up
    expectToBeSynced(alice, bob)

    // Alice and Bob both make changes; now they are out of sync
    for (let i = 0; i < N; i++) {
      alice.team.addRole(`alice-${i}`)
      bob.team.addRole(`bob-${i}`)
    }
    expectNotToBeSynced(alice, bob)

    alice.peer.sync()
    bob.peer.sync()
    const msgs = network.deliverAll()

    // Links sent should be N +1 per peer
    expect(countLinks(msgs)).toEqual(2 * (N + 1))

    // Now they are synced up again
    expectToBeSynced(alice, bob)
  })

  it('with simulated false positives', async () => {
    const [{ alice, bob }, network] = setup('alice', 'bob')
    network.connect(alice.peer, bob.peer)

    // Alice and Bob both make changes
    for (let i = 0; i < N; i++) {
      alice.team.addRole(`alice-${i}`)
      bob.team.addRole(`bob-${i}`)
    }
    expectNotToBeSynced(alice, bob)

    alice.peer.sync()
    bob.peer.sync()

    // Deliver messages but randomly omit some links
    const msgs = network.deliverAll(removeRandomLinks)

    // All links were eventually sent and none were repeated

    expect(countLinks(msgs)).toEqual(N + N + 1)
    expect(msgs.length).toBeLessThanOrEqual(5)

    // We were still able to sync up
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
  const linksInMessage = (message: NetworkMessage) =>
    message.body.links ? Object.keys(message.body.links).length : 0

  return messages.reduce((result, message) => result + linksInMessage(message), 0)
}

// this mutates a message containing multiple inks by removing one link
const removeRandomLinks: MessageMutator = msg => {
  const { links } = msg.body
  if (!links || Object.keys(links).length <= 3) return msg

  const hashes = Object.keys(links)
  const modifiedLinks = hashes.reduce((result, hash) => {
    return Math.random() < 0.1
      ? result
      : {
          ...result,
          [hash]: links[hash],
        }
  }, {})

  return {
    ...msg,
    body: {
      ...msg.body,
      links: modifiedLinks,
    },
  }
}

const logHashes = (a: UserStuff) => {
  console.log(a.userName, truncateHashes(getHashes(a.team.chain).join(', ')))
}
