import { create, validate, append } from '.'
import { Context, DeviceType, LocalUser, LinkType } from './types'
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
  it('new chain', () => {
    const chain = create({ payload: { team: 'Spies Я Us' }, context })
    const { isValid } = validate(chain)
    expect(isValid).toBe(true)
  })

  it('chain with an additional link', () => {
    const chain0 = create({ payload: { team: 'Spies Я Us' }, context })
    const chain = append({
      chain: chain0,
      link: {
        type: 'something',
        payload: {},
        user: alice.name,
        device: context.device,
        client: context.client,
      },
      localUser: alice,
    })

    const { isValid } = validate(chain)
    expect(isValid).toBe(true)
  })

  describe('canned chains', () => {
    const fsOpts = { encoding: 'utf8' }
    const assetsDir = join(__dirname, 'assets')

    describe('valid', () => {
      const validDir = join(assetsDir, 'valid')
      const validFiles = fs.readdirSync(validDir)
      for (const file of validFiles)
        test(file, () => {
          const chainJson = fs.readFileSync(join(validDir, file), fsOpts)
          const chain = JSON.parse(chainJson)
          const { isValid } = validate(chain)
          expect(isValid).toBe(true)
        })
    })

    describe('invalid', () => {
      const invalidDir = join(assetsDir, 'invalid')
      const invalidFiles = fs.readdirSync(invalidDir)
      for (const file of invalidFiles)
        test(file, () => {
          const chainJson = fs.readFileSync(join(invalidDir, file), fsOpts)
          const chain = JSON.parse(chainJson)
          const { isValid } = validate(chain)
          expect(isValid).toBe(false)
        })
    })
  })
})
