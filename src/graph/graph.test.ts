import { merge, create, getHead, getRoot, append } from '/graph'
import { defaultContext, alicesContext, bobsContext } from '/util/testing'

const __ = expect.objectContaining

describe('SignatureGraph', () => {
  test('create', () => {
    const graph = create('a', defaultContext)
    expect(getRoot(graph)).toEqual(__({ body: __({ payload: 'a' }) }))
    expect(getHead(graph)).toEqual(__({ body: __({ payload: 'a' }) }))
  })

  test('append', () => {
    const graph1 = create('a', defaultContext)
    const graph2 = append(graph1, { type: 'FOO', payload: 'b' }, defaultContext)
    expect(getRoot(graph2)).toEqual(__({ body: __({ payload: 'a' }) }))
    expect(getHead(graph2)).toEqual(__({ body: __({ payload: 'b' }) }))
  })

  describe('merge', () => {
    test('no changes', () => {
      // Alice creates a graph
      const aliceGraph = create('a', defaultContext)

      // she shares it with Bob
      const bobGraph = { ...aliceGraph }

      // after a while they sync back up
      const aliceMerged = merge(aliceGraph, bobGraph)
      const bobMerged = merge(bobGraph, aliceGraph)

      // nothing has changed
      expect(aliceMerged).toEqual(aliceGraph)
      expect(aliceMerged).toEqual(bobMerged)
      expect(bobMerged).toEqual(bobGraph)
    })

    test('edits on one side', () => {
      // Alice creates a graph and shares it with Bob
      const graph = create('a', defaultContext)

      // Alice makes edits
      const aliceGraph = append(graph, { type: 'FOO', payload: 'doin stuff' }, alicesContext)

      // Bob doesn't
      const bobGraph = { ...graph }

      // They sync back up
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
      // Alice creates a graph and shares it with Bob
      const aliceGraph = create('a', alicesContext)
      const bobGraph = { ...aliceGraph }

      // They make concurrent edits
      const aliceBranch1 = append(aliceGraph, { type: 'FOO', payload: 'alice 1' }, alicesContext)
      const aliceBranch2 = append(aliceBranch1, { type: 'FOO', payload: 'alice 2' }, alicesContext)
      const bobBranch = append(bobGraph, { type: 'FOO', payload: 'bob' }, bobsContext)

      // They sync back up
      const aliceMerged = merge(aliceBranch2, bobBranch)
      const bobMerged = merge(bobBranch, aliceBranch2)

      // Both graphs have changed
      expect(aliceMerged).not.toEqual(aliceBranch2)
      expect(bobMerged).not.toEqual(bobBranch)

      // but they're in sync with each other now
      expect(aliceMerged).toEqual(bobMerged)

      // The merged graphs have five nodes: ROOT, bob's change, alice's two changes, and MERGE
      expect(aliceMerged.nodes.size).toBe(5)
    })

    test(`can't merge graphs with different roots`, () => {
      const aliceGraph = create('a', alicesContext)
      const bobGraph = create('b', bobsContext)

      // nope
      const tryToMerge = () => merge(aliceGraph, bobGraph)
      expect(tryToMerge).toThrow()
    })
  })
})
