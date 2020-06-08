import { append } from '/chain/append'
import { create } from '/chain/create'
import { validate } from '/chain/validate'
import { signatures } from '/crypto'
import { alice, defaultContext } from '/team/tests/utils'

describe('chains', () => {
  describe('Alice creats a new chain', () => {
    test('Bob validates it', () => {
      // 👩🏾 Alice
      const chain = create({ team: 'Spies Я Us' }, defaultContext)

      // 👨‍🦲 Bob
      const { isValid } = validate(chain)
      expect(isValid).toBe(true)
    })

    test('Mallory tampers with the payload; Bob is not fooled', () => {
      // 👩🏾 Alice
      const chain = create({ team: 'Spies Я Us' }, defaultContext)

      // 🦹‍♂️ Mallory
      const payload = chain[0].body.payload as any
      payload.team = payload.team.replace('Spies', 'Dorks')

      // 👨‍🦲 Bob
      const validation = validate(chain)
      expect(validation.isValid).toBe(false)
    })
  })

  describe('Alice adds a link', () => {
    test('Bob validates it', () => {
      // 👩🏾 Alice
      const chain = create({ team: 'Spies Я Us' }, defaultContext)
      const newLink = { type: 'add-user', payload: { name: 'charlie' } }
      const newChain = append(chain, newLink, defaultContext)

      // 👨‍🦲 Bob
      const { isValid } = validate(newChain)
      expect(isValid).toBe(true)
    })

    test('Mallory changes the order of the links; Bob is not fooled', () => {
      // 👩🏾 Alice
      const chain = create({ team: 'Spies Я Us' }, defaultContext)
      const newLink = { type: 'add-user', payload: { name: 'charlie' } }
      const newChain = append(chain, newLink, defaultContext)

      // 🦹‍♂️ Mallory
      const wrongOrderChain = newChain.reverse()

      // 👨‍🦲 Bob
      const { isValid } = validate(wrongOrderChain)
      expect(isValid).toBe(false)
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
      const validation = validate(chain)
      expect(validation.isValid).toBe(false)
    })

    test('Bob saves a chain to a file and loads it later', () => {
      const chain = create({ team: 'Spies Я Us' }, defaultContext)

      // 👨‍🦲 Bob
      // serialize
      const chainJson = JSON.stringify(chain)
      // deserialize
      const rehydratedChain = JSON.parse(chainJson)
      const { isValid } = validate(rehydratedChain)
      expect(isValid).toBe(true)
    })
  })
})
