import fs from 'fs'
import { join } from 'path'
import { append, create, validate } from '.'
import { ContextWithSecrets, DeviceType } from '../context'
import { UserWithSecrets } from '../user'
import { deriveKeys, randomKey } from '../keys'

const alice: UserWithSecrets = {
  name: 'alice',
  keys: deriveKeys(randomKey()),
}

// const eve: UserWithSecrets = {
//   name: 'eve',
//   keys: deriveKeys(randomKey()),
// }

const context: ContextWithSecrets = {
  user: alice,
  device: {
    name: 'windows laptop',
    type: DeviceType.laptop,
  },
  client: {
    name: 'test',
    version: '0',
  },
}

describe('chains', () => {
  describe('Alice creats a new chain', () => {
    test('Bob validates it', () => {
      // Alice
      const chain = create({ team: 'Spies Я Us' }, context)

      // Bob
      const { isValid } = validate(chain)
      expect(isValid).toBe(true)
    })

    test('Eve tampers with the payload; Bob is not fooled', () => {
      // Alice
      const chain = create({ team: 'Spies Я Us' }, context)

      // Eve
      const { payload } = chain[0].body
      payload.team = payload.team.replace('Spies', 'Dorks')

      // Bob
      const { isValid } = validate(chain)
      expect(isValid).toBe(false)
    })
  })

  describe('Alice adds a link', () => {
    test('Bob validates it', () => {
      // Alice
      const chain = create({ team: 'Spies Я Us' }, context)
      const newLink = { type: 'add-user', payload: { name: 'charlie' } }
      const newChain = append(chain, newLink, context)

      // Bob
      const { isValid } = validate(newChain)
      expect(isValid).toBe(true)
    })

    test('Eve changes the order of the links; Bob is not fooled', () => {
      // Alice
      const chain = create({ team: 'Spies Я Us' }, context)
      const newLink = { type: 'add-user', payload: { name: 'charlie' } }
      const newChain = append(chain, newLink, context)

      // Eve
      const wrongOrderChain = newChain.reverse()

      // Bob
      const { isValid } = validate(wrongOrderChain)
      expect(isValid).toBe(false)
    })
  })

  describe('from JSON', () => {
    const fsOpts = { encoding: 'utf8' }
    const assetsDir = join(__dirname, 'assets')

    const testTypes = ['valid', 'invalid']
    testTypes.forEach(x => {
      const expected = x === 'valid' ? true : false

      describe(x, () => {
        const dir = join(assetsDir, x)
        const files = fs.readdirSync(dir)
        for (const file of files)
          test(file, () => {
            const filePath = join(dir, file)
            const chainJson = fs.readFileSync(filePath, fsOpts)
            const chain = JSON.parse(chainJson)
            const { isValid } = validate(chain)
            expect(isValid).toBe(expected)
          })
      })
    })
  })
})
