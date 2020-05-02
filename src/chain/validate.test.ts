import { create, validate } from '.'
import { Context, DeviceType, LocalUser } from './types'
import { deriveKeys, randomKey } from '../keys'
import fs from 'fs'
import { join } from 'path'

const alice: LocalUser = {
  name: 'alice',
  keys: deriveKeys(randomKey()),
}

// const bob: LocalUser = {
//   name: 'bob',
//   keys: deriveKeys(randomKey()),
// }

const context: Context = {
  localUser: alice,
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
  it('should validate a newly created chain', () => {
    const chain = create({ payload: { team: 'Spies Я Us' }, context })
    const { isValid } = validate(chain)
    expect(isValid).toBe(true)
  })

  describe('canned chains', () => {
    const fsOpts = { encoding: 'utf8' }
    const assets = join(__dirname, 'assets')

    const invalid = join(assets, 'invalid')
    const invalidChains = fs.readdirSync(invalid)
    for (const file of invalidChains)
      test(`invalid: ${file}`, () => {
        const chainJson = fs.readFileSync(join(invalid, file), fsOpts)
        const chain = JSON.parse(chainJson)
        const { isValid } = validate(chain)
        expect(isValid).toBe(false)
      })

    const valid = join(assets, 'valid')
    const validChains = fs.readdirSync(valid)
    for (const file of validChains)
      test(`valid: ${file}`, () => {
        const chainJson = fs.readFileSync(join(valid, file), fsOpts)
        const chain = JSON.parse(chainJson)
        const { isValid } = validate(chain)
        expect(isValid).toBe(true)
      })
  })
})
