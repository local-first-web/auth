import { TEST_GRAPH_KEYS as keys, setup } from '../../util/testing/setup.js'
import { clone } from 'lodash-es'
import '../../util/testing/expect/toBeValid.js'
import { describe, expect, test } from 'vitest'
import { append, createGraph, merge } from '../index.js'

const { alice, bob } = setup('alice', 'bob')
const defaultUser = alice

const _ = expect.objectContaining

describe('graphs', () => {
  describe('merge', () => {
    test('no changes', () => {
      // 👩🏾 Alice creates a graph and shares it with Bob
      const aliceGraph = createGraph({ user: defaultUser, name: 'a', keys })
      const bobGraph = clone(aliceGraph)

      // 👩🏾👨🏻‍🦲 after a while they sync back up
      const aliceMerged = merge(aliceGraph, bobGraph)
      const bobMerged = merge(bobGraph, aliceGraph)

      // nothing has changed
      expect(aliceMerged).toEqual(aliceGraph)
      expect(aliceMerged).toEqual(bobMerged)
      expect(bobMerged).toEqual(bobGraph)
    })

    test('edits on one side', () => {
      // 👩🏾 Alice creates a graph and shares it with Bob
      const graph = createGraph({ user: defaultUser, name: 'a', keys })
      const bobGraph = clone(graph)

      // 👩🏾 Alice makes edits
      const aliceGraph = append({
        graph,
        action: { type: 'FOO', payload: 'doin stuff' },
        user: alice,
        keys,
      })

      // 👨🏻‍🦲 Bob doesn't make any changes

      // 👩🏾👨🏻‍🦲 They sync back up
      const aliceMerged = merge(aliceGraph, bobGraph)
      const bobMerged = merge(bobGraph, aliceGraph)

      // They now have the same graph again
      expect(aliceMerged).toEqual(bobMerged)

      // Alice's graph didn't change
      expect(aliceMerged).toEqual(aliceGraph)

      // Bob's graph did change
      expect(bobMerged).not.toEqual(bobGraph)
    })

    test('concurrent edits', () => {
      // 👩🏾 Alice creates a graph and shares it with Bob
      const aliceGraph = createGraph({ user: alice, name: 'a', keys })
      const bobGraph = { ...aliceGraph }

      // 👩🏾 Alice makes changes while disconnected
      const aliceBranch1 = append({
        graph: aliceGraph,
        action: { type: 'FOO', payload: 'alice 1' },
        user: alice,
        keys,
      })
      const aliceBranch2 = append({
        graph: aliceBranch1,
        action: { type: 'FOO', payload: 'alice 2' },
        user: alice,
        keys,
      })

      // 👨🏻‍🦲 Bob makes changes while disconnected
      const bobBranch = append({
        graph: bobGraph,
        action: { type: 'FOO', payload: 'bob' },
        user: bob,
        keys,
      })

      // 👩🏾👨🏻‍🦲 They sync back up
      const aliceMerged = merge(aliceBranch2, bobBranch)
      const bobMerged = merge(bobBranch, aliceBranch2)

      // Both graphs have changed
      expect(aliceMerged).not.toEqual(aliceBranch2)
      expect(bobMerged).not.toEqual(bobBranch)

      // but they're in sync with each other now
      expect(aliceMerged).toEqual(bobMerged)

      // The merged graphs have 4 links: ROOT, bob's change, and alice's two changes
      expect(Object.keys(aliceMerged.links)).toHaveLength(4)
    })

    test(`can't merge graphs with different roots`, () => {
      const aliceGraph = createGraph({ user: alice, name: 'a', keys })
      const bobGraph = createGraph({ user: bob, name: 'b', keys })

      // nope
      const tryToMerge = () => merge(aliceGraph, bobGraph)
      expect(tryToMerge).toThrow()
    })
  })
})
