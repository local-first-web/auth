import { append, create, merge } from '@/chain'
import { clone } from '@/util'
import { setup } from '@/util/testing'
import '@/util/testing/expect/toBeValid'

const { alice, bob } = setup('alice', 'bob')
const defaultContext = alice.localContext
const __ = expect.objectContaining

describe('chains', () => {
  describe('merge', () => {
    test('no changes', () => {
      // 👩🏾 Alice creates a chain and shares it with Bob
      const aliceChain = create('a', defaultContext)
      const bobChain = clone(aliceChain)

      // 👩🏾👨🏻‍🦲 after a while they sync back up
      const aliceMerged = merge(aliceChain, bobChain)
      const bobMerged = merge(bobChain, aliceChain)

      // nothing has changed
      expect(aliceMerged).toEqual(aliceChain)
      expect(aliceMerged).toEqual(bobMerged)
      expect(bobMerged).toEqual(bobChain)
    })

    test('edits on one side', () => {
      // 👩🏾 Alice creates a chain and shares it with Bob
      const chain = create('a', defaultContext)
      const bobChain = clone(chain)

      // 👩🏾 Alice makes edits
      const aliceChain = append(chain, { type: 'FOO', payload: 'doin stuff' }, alice.localContext)

      // 👨🏻‍🦲 Bob doesn't make any changes

      // 👩🏾👨🏻‍🦲 They sync back up
      const aliceMerged = merge(aliceChain, bobChain)
      const bobMerged = merge(bobChain, aliceChain)

      // They now have the same chain again
      expect(aliceMerged).toEqual(bobMerged)

      // Alice's chain didn't change
      expect(aliceMerged).toEqual(aliceChain)

      // Bob's chain did change
      expect(bobMerged).not.toEqual(bobChain)
    })

    test('concurrent edits', () => {
      // 👩🏾 Alice creates a chain and shares it with Bob
      const aliceChain = create('a', alice.localContext)
      const bobChain = { ...aliceChain }

      // 👩🏾 Alice makes changes while disconnected
      const aliceBranch1 = append(
        aliceChain,
        { type: 'FOO', payload: 'alice 1' },
        alice.localContext
      )
      const aliceBranch2 = append(
        aliceBranch1,
        { type: 'FOO', payload: 'alice 2' },
        alice.localContext
      )

      // 👨🏻‍🦲 Bob makes changes while disconnected
      const bobBranch = append(bobChain, { type: 'FOO', payload: 'bob' }, bob.localContext)

      // 👩🏾👨🏻‍🦲 They sync back up
      const aliceMerged = merge(aliceBranch2, bobBranch)
      const bobMerged = merge(bobBranch, aliceBranch2)

      // Both chains have changed
      expect(aliceMerged).not.toEqual(aliceBranch2)
      expect(bobMerged).not.toEqual(bobBranch)

      // but they're in sync with each other now
      expect(aliceMerged).toEqual(bobMerged)

      // The merged chains have five links: ROOT, bob's change, alice's two changes, and MERGE
      expect(Object.keys(aliceMerged.links)).toHaveLength(5)
    })

    test(`can't merge chains with different roots`, () => {
      const aliceChain = create('a', alice.localContext)
      const bobChain = create('b', bob.localContext)

      // nope
      const tryToMerge = () => merge(aliceChain, bobChain)
      expect(tryToMerge).toThrow()
    })
  })
})
