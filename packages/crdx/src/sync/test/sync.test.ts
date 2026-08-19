import { asymmetric } from '@localfirst/crypto'
import { assert } from '@localfirst/shared'
import { append, createGraph, headsAreEqual, type Graph } from '../../graph/index.js'
import { generateMessage, initSyncState, receiveMessage } from '../index.js'
import { createUser, type UserWithSecrets } from '../../user/index.js'
import {
  expectNotToBeSynced,
  expectToBeSynced,
  setupWithNetwork,
  type Network,
} from '../../util/testing/Network.js'
import { TEST_GRAPH_KEYS as keys } from '../../util/testing/setup.js'
import { describe, expect, it, vitest } from 'vitest'

const { setSystemTime } = vitest.useFakeTimers()

const setup = setupWithNetwork(keys)

describe('sync', () => {
  describe('manual walkthrough', () => {
    it('Alice and Bob are already synced up', () => {
      // 👩🏾 Alice creates a graph
      const alice = createUser('alice')
      const graph = createGraph<any>({ user: alice, name: 'test graph', keys })
      let aliceGraph = append({
        graph,
        action: { type: 'FOO' },
        user: alice,
        keys,
      })
      let aliceSyncState = initSyncState()

      // 👨🏻‍🦲 Bob starts with an exact a copy of 👩🏾 Alice's graph
      let bobGraph = { ...aliceGraph }
      let bobSyncState = initSyncState()

      let msg
        // Neither 👩🏾 Alice nor 👨🏻‍🦲 Bob knows anything about the other's graph
      ;[aliceSyncState, msg] = generateMessage(aliceGraph, aliceSyncState)
      assert(msg)
      ;[bobGraph, bobSyncState] = receiveMessage(bobGraph, bobSyncState, msg, keys)

      // 👨🏻‍🦲 Bob is caught up, so he lets Alice know
      ;[bobSyncState, msg] = generateMessage(bobGraph, bobSyncState)
      assert(msg)
      ;[aliceGraph, aliceSyncState] = receiveMessage(aliceGraph, aliceSyncState, msg, keys)

      // 👩🏾 Alice is caught up, so she lets Bob know
      ;[aliceSyncState, msg] = generateMessage(aliceGraph, aliceSyncState)
      assert(msg)
      ;[bobGraph, bobSyncState] = receiveMessage(bobGraph, bobSyncState, msg, keys)

      // Neither one has anything further to say
      ;[bobSyncState, msg] = generateMessage(bobGraph, bobSyncState)
      expect(msg).toBeUndefined()
      ;[aliceSyncState, msg] = generateMessage(aliceGraph, aliceSyncState)
      expect(msg).toBeUndefined()
    })

    it('Alice is ahead of Bob', () => {
      // 👩🏾 Alice creates a graph
      const alice = createUser('alice')
      const graph = createGraph<any>({ user: alice, name: 'test graph', keys })

      // 👨🏻‍🦲 Bob has a copy of the original graph
      let bobGraph = { ...graph }
      let bobSyncState = initSyncState()

      // 👩🏾 Alice adds a link
      let aliceGraph = append({
        graph,
        action: { type: 'FOO' },
        user: alice,
        keys,
      })
      let aliceSyncState = initSyncState()

      let msg

        // Neither 👩🏾 Alice nor 👨🏻‍🦲 Bob knows anything about the other's graph
      ;[aliceSyncState, msg] = generateMessage(aliceGraph, aliceSyncState)
      assert(msg)
      ;[bobGraph, bobSyncState] = receiveMessage(bobGraph, bobSyncState, msg, keys)

      // 👨🏻‍🦲 Bob realizes he is missing a link, so he asks for it
      ;[bobSyncState, msg] = generateMessage(bobGraph, bobSyncState)
      assert(msg)
      ;[aliceGraph, aliceSyncState] = receiveMessage(aliceGraph, aliceSyncState, msg, keys)

      // 👩🏾 Alice provides the link 👨🏻‍🦲 Bob requested
      ;[aliceSyncState, msg] = generateMessage(aliceGraph, aliceSyncState)
      assert(msg)
      ;[bobGraph, bobSyncState] = receiveMessage(bobGraph, bobSyncState, msg, keys)

      // Neither one has anything further to say
      ;[bobSyncState, msg] = generateMessage(bobGraph, bobSyncState)
      expect(msg).toBeUndefined()
      ;[aliceSyncState, msg] = generateMessage(aliceGraph, aliceSyncState)
      expect(msg).toBeUndefined()

      // Bob knows that he is caught up with Alice
      expect(headsAreEqual(bobSyncState.their.head, aliceGraph.head)).toBe(true)
      // Alice knows that Bob is caught up with her
      expect(headsAreEqual(aliceSyncState.their.head, bobGraph.head)).toBe(true)
    })

    it('Alice and Bob have diverged', () => {
      const alice = createUser('alice')
      const bob = createUser('bob')

      // 👩🏾 Alice creates a graph
      let aliceGraph = createGraph<any>({
        user: alice,
        name: 'test graph',
        keys,
      })
      let aliceSyncState = initSyncState()

      // 👨🏻‍🦲 Bob has a copy of the original graph
      let bobGraph = { ...aliceGraph }
      let bobSyncState = initSyncState()

      // 👩🏾 Alice adds a link
      aliceGraph = append({
        graph: aliceGraph,
        action: { type: 'FOO' },
        user: alice,
        keys,
      })

      // concurrently, 👨🏻‍🦲 Bob adds a link
      bobGraph = append({
        graph: bobGraph,
        action: { type: 'BAR' },
        user: bob,
        keys,
      })

      let msg
        // Neither 👩🏾 Alice nor 👨🏻‍🦲 Bob knows anything about the other's graph
      ;[aliceSyncState, msg] = generateMessage(aliceGraph, aliceSyncState)
      assert(msg)
      ;[bobGraph, bobSyncState] = receiveMessage(bobGraph, bobSyncState, msg, keys)

      // 👨🏻‍🦲 Bob realizes he is missing a link, so he asks for it
      // 👨🏻‍🦲 Bob sees that Alice is missing one of his links, so he sends it
      ;[bobSyncState, msg] = generateMessage(bobGraph, bobSyncState)
      assert(msg)
      ;[aliceGraph, aliceSyncState] = receiveMessage(aliceGraph, aliceSyncState, msg, keys)

      // 👩🏾 Alice now has Bob's full graph, so she can merge with it
      // 👩🏾 Alice provides the link 👨🏻‍🦲 Bob requested, as well as the new merge link
      ;[aliceSyncState, msg] = generateMessage(aliceGraph, aliceSyncState)
      assert(msg)
      ;[bobGraph, bobSyncState] = receiveMessage(bobGraph, bobSyncState, msg, keys)

      // 👨🏻‍🦲 Bob is caught up, so he lets Alice know
      ;[bobSyncState, msg] = generateMessage(bobGraph, bobSyncState)
      assert(msg)
      ;[aliceGraph, aliceSyncState] = receiveMessage(aliceGraph, aliceSyncState, msg, keys)

      // Neither one has anything further to say
      ;[bobSyncState, msg] = generateMessage(bobGraph, bobSyncState)
      expect(msg).toBeUndefined()
      ;[aliceSyncState, msg] = generateMessage(aliceGraph, aliceSyncState)
      expect(msg).toBeUndefined()
    })
  })

  describe('with simulated network', () => {
    describe('manual setup', () => {
      const N = 15 // "many"

      it('one change', () => {
        const {
          userRecords: { alice, bob },
          network,
        } = setup('alice', 'bob')
        network.connect(alice.peer, bob.peer)

        // no changes yet; 👩🏾 Alice and 👨🏻‍🦲 Bob are synced up
        expectToBeSynced(alice, bob)

        // 👩🏾 Alice makes a change; now they are out of sync
        alice.peer.graph = append({
          graph: alice.peer.graph,
          action: { type: 'FOO' },
          user: alice.user,
          keys,
        })
        expectNotToBeSynced(alice, bob)

        // 👩🏾 Alice exchanges sync messages with 👨🏻‍🦲 Bob
        alice.peer.sync()
        network.deliverAll()

        // Now they are synced up again
        expectToBeSynced(alice, bob)
      })

      it('many changes', () => {
        const {
          userRecords: { alice, bob },
          network,
        } = setup('alice', 'bob')
        network.connect(alice.peer, bob.peer)
        // no changes yet; 👩🏾 Alice and 👨🏻‍🦲 Bob are synced up
        expectToBeSynced(alice, bob)
        // 👩🏾 Alice makes many changes; now they are out of sync
        for (let i = 0; i < N; i++) {
          alice.peer.graph = append({
            graph: alice.peer.graph,
            action: { type: 'FOO', payload: i },
            user: alice.user,
            keys,
          })
        }

        expectNotToBeSynced(alice, bob)
        // 👩🏾 Alice exchanges sync messages with 👨🏻‍🦲 Bob
        alice.peer.sync()
        const msgs = network.deliverAll()
        expect(msgs.length).toBeLessThanOrEqual(5)
        // Now they are synced up again
        expectToBeSynced(alice, bob)
      })

      it('many changes followed by a single change', () => {
        const {
          userRecords: { alice, bob },
          network,
        } = setup('alice', 'bob')
        network.connect(alice.peer, bob.peer)

        // 👩🏾 Alice makes many changes
        for (let i = 0; i < N; i++) {
          alice.peer.graph = append({
            graph: alice.peer.graph,
            action: { type: 'FOO', payload: i },
            user: alice.user,
            keys,
          })
        }

        alice.peer.sync()
        network.deliverAll()

        // they're synced up again
        expectToBeSynced(alice, bob)

        // 👩🏾 Alice makes one more change
        alice.peer.graph = append({
          graph: alice.peer.graph,
          action: { type: 'FOO', payload: 999 },
          user: alice.user,
          keys,
        })
        alice.peer.sync()

        const msgs = network.deliverAll()
        expect(msgs.length).toBeLessThanOrEqual(3)
        expectToBeSynced(alice, bob)
      })

      it('concurrent changes', () => {
        const {
          userRecords: { alice, bob },
          network,
        } = setup('alice', 'bob')
        network.connect(alice.peer, bob.peer)

        // no changes yet; 👩🏾 Alice and 👨🏻‍🦲 Bob are synced up
        alice.peer.sync()
        network.deliverAll()

        expectToBeSynced(alice, bob)

        // 👩🏾 Alice and 👨🏻‍🦲 Bob both make changes; now they are out of sync
        alice.peer.graph = append({
          graph: alice.peer.graph,
          action: { type: 'FOO', payload: 999 },
          user: alice.user,
          keys,
        })
        bob.peer.graph = append({
          graph: bob.peer.graph,
          action: { type: 'PIZZA', payload: 42 },
          user: bob.user,
          keys,
        })
        expectNotToBeSynced(alice, bob)

        // 👩🏾 Alice exchanges sync messages with 👨🏻‍🦲 Bob
        alice.peer.sync()
        const msgs = network.deliverAll()

        expect(msgs.length).toBeLessThanOrEqual(4)

        // Now they are synced up again
        expectToBeSynced(alice, bob)
      })

      it('many concurrent changes', () => {
        const {
          userRecords: { alice, bob },
          network,
        } = setup('alice', 'bob')
        network.connect(alice.peer, bob.peer)
        for (let i = 0; i < N; i++) {
          alice.peer.graph = append({
            graph: alice.peer.graph,
            action: { type: 'FOO', payload: i },
            user: alice.user,
            keys,
          })
        }

        alice.peer.sync()
        network.deliverAll()

        // no changes yet; 👩🏾 Alice and 👨🏻‍🦲 Bob are synced up
        expectToBeSynced(alice, bob)

        // 👩🏾 Alice and 👨🏻‍🦲 Bob both make changes; now they are out of sync
        for (let i = 0; i < N; i++) {
          alice.peer.graph = append({
            graph: alice.peer.graph,
            action: { type: 'BOO', payload: i },
            user: alice.user,
            keys,
          })
          bob.peer.graph = append({
            graph: bob.peer.graph,
            action: { type: 'PIZZA', payload: i },
            user: bob.user,
            keys,
          })
        }

        expectNotToBeSynced(alice, bob)
        alice.peer.sync()
        const msgs = network.deliverAll()

        expect(msgs.length).toBeLessThanOrEqual(4)

        // Now they are synced up again
        expectToBeSynced(alice, bob)
      })

      it('repeated sets of concurrent changes', () => {
        const {
          userRecords: { alice, bob },
          network,
        } = setup('alice', 'bob')
        network.connect(alice.peer, bob.peer)

        // 👩🏾 Alice and 👨🏻‍🦲 Bob are synced up
        alice.peer.sync()
        network.deliverAll()
        expectToBeSynced(alice, bob)

        for (let j = 0; j < 4; j++) {
          // 👩🏾 Alice and 👨🏻‍🦲 Bob both make changes; now they are out of sync
          for (let i = 0; i < 4; i++) {
            alice.peer.graph = append({
              graph: alice.peer.graph,
              action: { type: 'BOO', payload: j * 10 + i },
              user: alice.user,
              keys,
            })
            bob.peer.graph = append({
              graph: bob.peer.graph,
              action: { type: 'PIZZA', payload: j * 10 + i },
              user: bob.user,
              keys,
            })
          }

          expectNotToBeSynced(alice, bob)
          alice.peer.sync()
          const msgs = network.deliverAll()

          expect(msgs.length).toBeLessThanOrEqual(4)

          // Now they are synced up again
          expectToBeSynced(alice, bob)
        }
      })

      it('three peers, concurrent changes', () => {
        const {
          userRecords: { alice, bob, charlie },
          network,
        } = setup('alice', 'bob', 'charlie')
        network.connect(alice.peer, bob.peer)
        network.connect(alice.peer, charlie.peer)
        network.connect(bob.peer, charlie.peer)

        alice.peer.graph = append({
          graph: alice.peer.graph,
          action: { type: 'FOO' },
          user: alice.user,
          keys,
        })

        alice.peer.sync()
        network.deliverAll()

        // no changes yet; everyone is synced up
        expectToBeSynced(alice, bob)
        expectToBeSynced(bob, charlie)
        expectToBeSynced(alice, charlie)

        // everyone makes changes while offline; now they are out of sync
        alice.peer.graph = append({
          graph: alice.peer.graph,
          action: { type: 'A' },
          user: alice.user,
          keys,
        })
        bob.peer.graph = append({
          graph: bob.peer.graph,
          action: { type: 'B' },
          user: bob.user,
          keys,
        })
        charlie.peer.graph = append({
          graph: charlie.peer.graph,
          action: { type: 'C' },
          user: charlie.user,
          keys,
        })
        expectNotToBeSynced(alice, bob)

        // now they reconnect and sync back up
        alice.peer.sync()
        const msgs = network.deliverAll()

        expect(msgs.length).toBeLessThanOrEqual(22)

        // Now they are synced up again
        expectToBeSynced(alice, bob)
        expectToBeSynced(bob, charlie)
        expectToBeSynced(alice, charlie)
      })
    })

    describePeers('a', 'b')
    describePeers('a', 'b', 'c')
    describePeers('a', 'b', 'c', 'd')
    describePeers('a', 'b', 'c', 'd', 'e')
    describePeers('a', 'b', 'c', 'd', 'e', 'f')

    function describePeers(...userNames: string[]) {
      describe(`${userNames.length} peers`, () => {
        function connectAll(network: Network) {
          const peers = Object.values(network.peers)
          for (const [i, a] of peers.entries()) {
            const followingPeers = peers.slice(i + 1)
            for (const b of followingPeers) {
              network.connect(a, b)
            }
          }

          return [userNames, network]
        }

        function connectDaisyGraph(network: Network) {
          const peers = Object.values(network.peers)
          for (const [i, a] of peers.slice(0, -1).entries()) {
            const b = peers[i + 1]
            network.connect(a, b)
          }

          return network
        }

        function assertAllEqual(network: Network) {
          const peers = Object.values(network.peers)
          for (const [i, a] of peers.slice(0, -1).entries()) {
            const b = peers[i + 1]
            expect(a.graph.head).toEqual(b.graph.head)
          }
        }

        function assertAllDifferent(network: Network) {
          const peers = Object.values(network.peers)
          for (const [i, a] of peers.slice(0, -1).entries()) {
            const b = peers[i + 1]
            expect(a.graph.head).not.toEqual(b.graph.head)
          }
        }

        it(`syncs a single change (direct connections)`, () => {
          const { network, founder } = setup(...userNames)
          connectAll(network)

          // first user makes a change
          founder.peer.graph = append({
            graph: founder.peer.graph,
            action: { type: 'FOO' },
            user: founder.user,
            keys,
          })

          founder.peer.sync()
          const msgs = network.deliverAll()

          expect(msgs.length).toBeLessThanOrEqual(65)

          // all peers have the same doc
          assertAllEqual(network)
        })

        it(`syncs a single change (indirect connections)`, () => {
          const { network, founder } = setup(...userNames)

          connectDaisyGraph(network)

          // first user makes a change
          founder.peer.graph = append({
            graph: founder.peer.graph,
            action: { type: 'FOO' },
            user: founder.user,
            keys,
          })

          founder.peer.sync()
          network.deliverAll()

          // all peers have the same doc
          assertAllEqual(network)
        })

        it(`syncs multiple changes (direct connections)`, () => {
          const { userRecords, network, founder } = setup(...userNames)

          connectAll(network)

          // each user makes a change
          for (const userName in userRecords) {
            const { user, peer } = userRecords[userName]
            peer.graph = append({
              graph: peer.graph,
              action: { type: userName.toUpperCase() },
              user,
              keys,
            })
          }

          founder.peer.sync()
          const msgs = network.deliverAll()

          expect(msgs.length).toBeLessThanOrEqual(300)

          // all peers have the same doc
          assertAllEqual(network)
        })

        it(`syncs multiple changes (indirect connections)`, () => {
          const { userRecords, network, founder } = setup(...userNames)

          connectDaisyGraph(network)

          // each user makes a change
          for (const userName in userRecords) {
            const { user, peer } = userRecords[userName]
            peer.graph = append({
              graph: peer.graph,
              action: { type: userName.toUpperCase() },
              user,
              keys,
            })
          }

          founder.peer.sync()
          const msgs = network.deliverAll()

          expect(msgs.length).toBeLessThanOrEqual(55)

          // all peers have the same doc
          assertAllEqual(network)
        })

        it('syncs divergent changes (indirect connections)', function () {
          const { userRecords, network, founder } = setup(...userNames)

          connectDaisyGraph(network)

          // each user makes a change
          for (const userName in userRecords) {
            const { user, peer } = userRecords[userName]
            peer.graph = append({
              graph: peer.graph,
              action: { type: userName.toUpperCase() },
              user,
              keys,
            })
          }

          // while they're disconnected, they have divergent docs
          assertAllDifferent(network)

          founder.peer.sync()
          const msgs = network.deliverAll()

          expect(msgs.length).toBeLessThanOrEqual(55)

          // after connecting, their docs converge
          assertAllEqual(network)
        })

        it('syncs divergent changes (direct connections)', function () {
          const { userRecords, network, founder } = setup(...userNames)

          connectAll(network)

          // each user makes a change
          for (const userName in userRecords) {
            const { user, peer } = userRecords[userName]
            peer.graph = append({
              graph: peer.graph,
              action: { type: userName.toUpperCase() },
              user,
              keys,
            })
          }

          // while they're disconnected, they have divergent docs
          assertAllDifferent(network)

          founder.peer.sync()
          const msgs = network.deliverAll()

          expect(msgs.length).toBeLessThanOrEqual(300)

          // after connecting, their docs converge
          assertAllEqual(network)
        })
      })
    }
  })

  describe('clock skew', () => {
    const TEN_MINUTES = 10 * 60 * 1000

    const appendWithClockOffset = (
      graph: Graph<any, any>,
      user: UserWithSecrets,
      offset: number
    ) => {
      const now = Date.now()
      setSystemTime(now + offset)
      const updatedGraph = append({
        graph,
        action: { type: 'FOO', payload: 'pizza' },
        user,
        keys,
      })
      setSystemTime(now)
      return updatedGraph
    }

    it('syncs with a peer whose clock is ten minutes fast', () => {
      const {
        userRecords: { alice, bob },
        network,
      } = setup('alice', 'bob')
      network.connect(alice.peer, bob.peer)
      expectToBeSynced(alice, bob)

      // 👨🏻‍🦲 Bob's clock is ten minutes fast — no adversary, just an NTP step or a resume from sleep
      bob.peer.graph = appendWithClockOffset(bob.peer.graph, bob.user, TEN_MINUTES)
      const newHash = bob.peer.graph.head[0]

      bob.peer.sync()
      network.deliverAll()

      // 👩🏾 Alice takes his link; a timestamp she can't yet vouch for isn't a reason to refuse it
      expect(alice.peer.graph.links).toHaveProperty(newHash)
      expectToBeSynced(alice, bob)

      // and she doesn't hold it against him — but she does notice, and can say so
      expect(alice.peer.syncStates.bob.failedSyncCount).toBe(0)
      expect(alice.peer.syncStates.bob.advisoryFailureCount).toBe(1)
      expect(alice.peer.syncStates.bob.lastAdvisoryError?.message).toMatch(
        /timestamp is in the future/
      )
    })

    it('syncs a link that is older than the link it descends from', () => {
      const {
        userRecords: { alice, bob },
        network,
      } = setup('alice', 'bob')
      network.connect(alice.peer, bob.peer)

      // 👨🏻‍🦲 Bob appends on a clock ten minutes fast...
      bob.peer.graph = appendWithClockOffset(bob.peer.graph, bob.user, TEN_MINUTES)
      bob.peer.sync()
      network.deliverAll()

      // ...and then, on a correct clock, appends again: the new link is older than its parent
      bob.peer.graph = appendWithClockOffset(bob.peer.graph, bob.user, 0)
      const outOfOrderHash = bob.peer.graph.head[0]

      bob.peer.sync()
      network.deliverAll()

      expect(alice.peer.graph.links).toHaveProperty(outOfOrderHash)
      expectToBeSynced(alice, bob)
      expect(alice.peer.syncStates.bob.failedSyncCount).toBe(0)
      expect(alice.peer.syncStates.bob.advisoryFailureCount).toBeGreaterThan(0)
      expect(alice.peer.syncStates.bob.lastAdvisoryError?.message).toMatch(/timestamp/)
    })
  })

  describe('failure handling', () => {
    /**
     * Appends a link and then rewrites its body without rewriting its hash, so the link no longer
     * is the bytes it claims to be. That's structural — it fails the head bookkeeping check on the
     * way in, and `validateHash` behind it — and structural is what the wire path refuses a merge
     * for. (This used to be a backdated link, which is now advisory; see the clock skew tests.)
     */
    const appendTamperedLink = (graph: Graph<any, any>, user: UserWithSecrets) => {
      const updatedGraph = append({
        graph,
        action: { type: 'FOO', payload: 'pizza' },
        user,
        keys,
      })

      const hash = updatedGraph.head[0]
      const link = updatedGraph.links[hash]
      link.body.payload = 'tampered'
      updatedGraph.encryptedLinks[hash] = {
        encryptedBody: asymmetric.encryptBytes({
          secret: link.body,
          recipientPublicKey: keys.encryption.publicKey,
          senderSecretKey: user.keys.encryption.secretKey,
        }),
        recipientPublicKey: keys.encryption.publicKey,
        senderPublicKey: user.keys.encryption.publicKey,
      }

      return updatedGraph
    }

    it('single failure', () => {
      const {
        userRecords: { alice, eve },
        network,
      } = setup('alice', 'eve')
      network.connect(alice.peer, eve.peer)

      // no changes yet; 👩🏾 Alice and 🦹‍♀️ Eve are synced up
      expectToBeSynced(alice, eve)

      // 🦹‍♀️ Eve rewrites a link's body without rewriting its hash
      eve.peer.graph = appendTamperedLink(eve.peer.graph, eve.user)
      const badHash = eve.peer.graph.head[0]

      eve.peer.sync()

      // Since Eve's graph is invalid, the sync fails
      expect(() => network.deliverAll()).toThrow(`Head hash does not match`)

      // They are not synced
      expectNotToBeSynced(alice, eve)

      // Alice doesn't have the bad link
      expect(alice.peer.graph.links).not.toHaveProperty(badHash)

      // and this is a failed sync, not a note about someone's clock
      expect(alice.peer.syncStates.eve.failedSyncCount).toBe(1)
      expect(alice.peer.syncStates.eve.advisoryFailureCount).toBe(0)
    })

    it('repeated failures', () => {
      const {
        userRecords: { alice, eve },
        network,
      } = setup('alice', 'eve')
      network.connect(alice.peer, eve.peer)

      // no changes yet; 👩🏾 Alice and 🦹‍♀️ Eve are synced up
      expectToBeSynced(alice, eve)

      const originalGraph = eve.peer.graph

      const TRIES = 10
      for (let i = 0; i < TRIES; i++) {
        // 🦹‍♀️ Eve rewrites a link's body without rewriting its hash
        eve.peer.graph = appendTamperedLink(originalGraph, eve.user)
        const badHash = eve.peer.graph.head[0]

        eve.peer.sync()

        // Since Eve's graph is invalid, the sync fails
        expect(() => network.deliverAll()).toThrow('Head hash does not match')

        // They are not synced
        expectNotToBeSynced(alice, eve)

        // 👩🏾 Alice doesn't have the bad link
        expect(alice.peer.graph.links).not.toHaveProperty(badHash)
      }

      // 👩🏾 Alice knows how many times Eve failed to sync
      expect(alice.peer.syncStates.eve.failedSyncCount).toBe(TRIES)
    })
  })
})
