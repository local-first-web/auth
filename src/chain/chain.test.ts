import { append } from '/chain/append'
import { create } from '/chain/create'
import { validate } from '/chain/validate'
import { signatures } from '/crypto'
import { alice, defaultContext } from '/util/testing'

import '/util/testing/expect/toBeValid'

describe('chains', () => {
  describe('Alice creats a new chain', () => {
    test('Bob validates it', () => {
      // 👩🏾 Alice
      const chain = create({ team: 'Spies Я Us' }, defaultContext)

      // 👨‍🦲 Bob
      expect(validate(chain)).toBeValid()
    })

    test('Mallory tampers with the payload; Bob is not fooled', () => {
      // 👩🏾 Alice
      const chain = create({ team: 'Spies Я Us' }, defaultContext)

      // 🦹‍♂️ Mallory
      const payload = chain[0].body.payload as any
      payload.team = payload.team.replace('Spies', 'Dorks')

      // 👨‍🦲 Bob
      expect(validate(chain)).not.toBeValid()
    })
  })

  describe('Alice adds a link', () => {
    test('Bob validates it', () => {
      // 👩🏾 Alice
      const chain = create({ team: 'Spies Я Us' }, defaultContext)
      const newLink = { type: 'add-user', payload: { name: 'charlie' } }
      const newChain = append(chain, newLink, defaultContext)

      // 👨‍🦲 Bob
      expect(validate(chain)).toBeValid()
    })

    test('Mallory changes the order of the links; Bob is not fooled', () => {
      // 👩🏾 Alice
      const chain = create({ team: 'Spies Я Us' }, defaultContext)
      const newLink = { type: 'add-user', payload: { name: 'charlie' } }
      const newChain = append(chain, newLink, defaultContext)

      // 🦹‍♂️ Mallory
      const wrongOrderChain = newChain.reverse()

      // 👨‍🦲 Bob
      expect(validate(wrongOrderChain)).not.toBeValid()
    })

    test('Alice, for reasons only she understands, munges the type of the first link; validation fails', () => {
      // 👩🏾 Alice
      const chain = create({ team: 'Spies Я Us' }, defaultContext)

      const { body } = chain[0]
      body.type = 'IS_IT_SPELLED_ROOT_OR_ROUTE_OR_REWT'

      // she re-signs the messed-up link because she wants the world to burn
      const { secretKey, publicKey } = alice.keys.signature
      const signature = signatures.sign(body, secretKey)
      chain[0].signed = {
        userName: alice.userName,
        signature,
        key: publicKey,
      }

      // 👨‍🦲 Bob
      expect(validate(chain)).not.toBeValid()
    })

    test('Bob saves a chain to a file and loads it later', () => {
      const chain = create({ team: 'Spies Я Us' }, defaultContext)

      // 👨‍🦲 Bob
      // serialize
      const chainJson = JSON.stringify(chain)
      // deserialize
      const rehydratedChain = JSON.parse(chainJson)
      expect(validate(rehydratedChain)).toBeValid()
    })
  })
})
