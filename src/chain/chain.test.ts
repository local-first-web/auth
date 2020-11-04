import { signatures } from '@herbcaudill/crypto'
import { validate } from '/chain/validate'
import { append, create, merge, ROOT } from '/chain'
import { getHead } from '/chain/getHead'
import { getRoot } from '/chain/getRoot'
import { alice, alicesContext, bobsContext, defaultContext } from '/util/testing'
import '/util/testing/expect/toBeValid'
import { serialize } from './serialize'
import { deserialize } from './deserialize'
import { clone } from './clone'

const __ = expect.objectContaining

describe('chains', () => {
  test('create', () => {
    const chain = create('a', defaultContext)
    expect(getRoot(chain)).toEqual(__({ body: __({ payload: 'a' }) }))
    expect(getHead(chain)).toEqual(__({ body: __({ payload: 'a' }) }))
  })

  test('append', () => {
    const chain1 = create('a', defaultContext)
    const chain2 = append(chain1, { type: 'FOO', payload: 'b' }, defaultContext)
    expect(getRoot(chain2)).toEqual(__({ body: __({ payload: 'a' }) }))
    expect(getHead(chain2)).toEqual(__({ body: __({ payload: 'b' }) }))
  })

  describe('merge', () => {
    test('no changes', () => {
      // 👩🏾 Alice creates a chain and shares it with Bob
      const aliceChain = create('a', defaultContext)
      const bobChain = clone(aliceChain)

      // 👩🏾👨‍🦲 after a while they sync back up
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
      const aliceChain = append(chain, { type: 'FOO', payload: 'doin stuff' }, alicesContext)

      // 👨‍🦲 Bob doesn't make any changes

      // 👩🏾👨‍🦲 They sync back up
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
      const aliceChain = create('a', alicesContext)
      const bobChain = { ...aliceChain }

      // 👩🏾 Alice makes changes while disconnected
      const aliceBranch1 = append(aliceChain, { type: 'FOO', payload: 'alice 1' }, alicesContext)
      const aliceBranch2 = append(aliceBranch1, { type: 'FOO', payload: 'alice 2' }, alicesContext)

      // 👨‍🦲 Bob makes changes while disconnected
      const bobBranch = append(bobChain, { type: 'FOO', payload: 'bob' }, bobsContext)

      // 👩🏾👨‍🦲 They sync back up
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
      const aliceChain = create('a', alicesContext)
      const bobChain = create('b', bobsContext)

      // nope
      const tryToMerge = () => merge(aliceChain, bobChain)
      expect(tryToMerge).toThrow()
    })
  })

  describe('persistence', () => {
    test('Bob saves a chain to a file and loads it later', () => {
      // 👨‍🦲 Bob
      const chain = create({ team: 'Spies Я Us' }, defaultContext)

      // serialize
      const chainJson = serialize(chain)

      // deserialize
      const rehydratedChain = deserialize(chainJson)

      expect(validate(rehydratedChain)).toBeValid()
    })
  })

  describe('validation', () => {
    test(`Bob validates Alice's new chain`, () => {
      // 👩🏾 Alice
      const chain = create({ team: 'Spies Я Us' }, defaultContext)

      // 👨‍🦲 Bob
      expect(validate(chain)).toBeValid()
    })

    test(`Bob validates Alice's chain with a couple of links`, () => {
      // 👩🏾 Alice
      const chain = create({ team: 'Spies Я Us' }, defaultContext)
      const newLink = { type: 'add-user', payload: { name: 'charlie' } }
      const newChain = append(chain, newLink, defaultContext)

      // 👨‍🦲 Bob
      expect(validate(newChain)).toBeValid()
    })

    test('Mallory tampers with the payload; Bob is not fooled', () => {
      // 👩🏾 Alice
      const chain = create({ team: 'Spies Я Us' }, defaultContext)

      // 🦹‍♂️ Mallory
      const payload = getRoot(chain).body.payload as any
      payload.team = payload.team.replace('Spies', 'Dorks')

      // 👨‍🦲 Bob
      expect(validate(chain)).not.toBeValid()
    })

    test('Alice, for reasons only she understands, munges the type of the first link; validation fails', () => {
      // 👩🏾 Alice
      const chain = create({ team: 'Spies Я Us' }, defaultContext)

      const root = getRoot(chain)
      // @ts-ignore
      root.body.type = 'IS_IT_SPELLED_ROOT_OR_ROUTE_OR_REWT'

      // she re-signs the messed-up link because she wants the world to burn
      const { secretKey, publicKey } = alice.keys.signature
      const signature = signatures.sign(root.body, secretKey)

      chain.links[chain.root] = {
        ...root,
        signed: {
          userName: alice.userName,
          signature,
          key: publicKey,
        },
      }

      // 👨‍🦲 Bob
      expect(validate(chain)).not.toBeValid()
    })

    test('Alice gets high and tries to add another ROOT link', () => {
      // 👩🏾 Alice
      const chain = create({ team: 'Spies Я Us' }, defaultContext)

      const link = {
        type: ROOT,
        payload: { foo: 'pizza' },
      }

      // add it to an empty chain
      const newChain = append(chain, link, defaultContext)

      // nope
      expect(validate(newChain)).not.toBeValid()
    })
  })
})
