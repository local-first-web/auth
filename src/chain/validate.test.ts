import fs from 'fs'
import { join } from 'path'
import { append, create, validate } from '.'
import { deriveKeys, randomKey } from '../keys'
import { ContextWithSecrets, DeviceType, UserWithSecrets } from './types'

const alice: UserWithSecrets = {
  name: 'alice',
  keys: deriveKeys(randomKey()),
}

const context: ContextWithSecrets = {
  user: alice,
  device: {
    id: randomKey(8),
    name: 'windows laptop',
    type: DeviceType.laptop,
  },
  client: {
    name: 'test',
    version: '0',
  },
}

describe('validate', () => {
  it('new chain', () => {
    const chain = create({ team: 'Spies Я Us' }, context)
    const { isValid } = validate(chain)
    expect(isValid).toBe(true)
  })

  it('chain with one additional link', () => {
    const chain = create({ team: 'Spies Я Us' }, context)
    const newLink = { type: 'something', payload: {} }
    const newChain = append(chain, newLink, context)
    const { isValid } = validate(newChain)
    expect(isValid).toBe(true)
  })

  describe('stored chains', () => {
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
