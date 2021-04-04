import { signatures } from '@herbcaudill/crypto'
import { append, create, ROOT } from '@/chain'
import { getRoot } from '@/chain/getRoot'
import { validate } from '@/chain/validate'
import { setup } from '@/util/testing'
import '@/util/testing/expect/toBeValid'

const __ = expect.objectContaining

const { alice } = setup('alice')

describe('chains', () => {
  describe('validation', () => {
    test(`Bob validates Alice's new chain`, () => {
      // 👩🏾 Alice
      const chain = create({ team: 'Spies Я Us' }, alice.localContext)

      // 👨🏻‍🦲 Bob
      expect(validate(chain)).toBeValid()
    })

    test(`Bob validates Alice's chain with a couple of links`, () => {
      // 👩🏾 Alice
      const chain = create({ team: 'Spies Я Us' }, alice.localContext)
      const newLink = { type: 'add-user', payload: { name: 'charlie' } }
      const newChain = append(chain, newLink, alice.localContext)

      // 👨🏻‍🦲 Bob
      expect(validate(newChain)).toBeValid()
    })

    test('Mallory tampers with the payload; Bob is not fooled', () => {
      // 👩🏾 Alice
      const chain = create({ team: 'Spies Я Us' }, alice.localContext)

      // 🦹‍♂️ Mallory
      const payload = getRoot(chain).body.payload as any
      payload.team = payload.team.replace('Spies', 'Dorks')

      // 👨🏻‍🦲 Bob
      expect(validate(chain)).not.toBeValid()
    })

    test('Alice, for reasons only she understands, munges the type of the first link; validation fails', () => {
      // 👩🏾 Alice
      const chain = create({ team: 'Spies Я Us' }, alice.localContext)

      const root = getRoot(chain)
      // @ts-ignore
      root.body.type = 'IS_IT_SPELLED_ROOT_OR_ROUTE_OR_REWT'

      // she re-signs the messed-up link because she wants to see the world burn
      const { secretKey, publicKey } = alice.user.keys.signature
      const signature = signatures.sign(root.body, secretKey)

      chain.links[chain.root] = {
        ...root,
        signed: {
          userName: alice.userName,
          deviceName: 'alicez phone',
          signature,
          key: publicKey,
        },
      }

      // 👨🏻‍🦲 Bob
      expect(validate(chain)).not.toBeValid()
    })

    test('Alice gets high and tries to add another ROOT link', () => {
      // 👩🏾 Alice
      const chain = create({ team: 'Spies Я Us' }, alice.localContext)

      const link = {
        type: ROOT,
        payload: { foo: 'pizza' },
      }

      // add it to an empty chain
      const newChain = append(chain, link, alice.localContext)

      // nope
      expect(validate(newChain)).not.toBeValid()
    })
  })
})
