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
    })

    test('concurrent edits', () => {
      // Alice creates a graph and shares it with Bob
      const aliceGraph = create('a', alicesContext)
      const bobGraph = { ...aliceGraph }

      // They make concurrent edits
      const aliceBranch = append(aliceGraph, { type: 'FOO', payload: 'branch-a' }, alicesContext)
      const bobBranch = append(bobGraph, { type: 'FOO', payload: 'branch-b' }, bobsContext)

      // They sync back up
      const aliceMerged = merge(aliceBranch, bobBranch)
      const bobMerged = merge(bobBranch, aliceBranch)

      // They now have the same graph again
      expect(aliceMerged).toEqual(bobMerged)
    })

    test(`can't merge graphs with different roots`, () => {
      const aliceGraph = create('a', alicesContext)
      const bobGraph = create('b', bobsContext)

      const tryToMerge = () => merge(aliceGraph, bobGraph)
      expect(tryToMerge).toThrow()
    })
  })
})
