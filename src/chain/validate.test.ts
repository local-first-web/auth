import { create, append, validate } from '.'
import { LocalUser, Context, DeviceType } from './types'
import { deriveKeys, randomKey } from '/keys'

const alice: LocalUser = {
  name: 'alice',
  keys: deriveKeys(randomKey()),
}
const bob: LocalUser = {
  name: 'bob',
  keys: deriveKeys(randomKey()),
}

const context: Context = {
  localUser: alice,
  device: {
    id: randomKey(),
    name: 'windows laptop',
    type: DeviceType.laptop,
  },
  client: {
    name: 'test',
    version: '0',
  },
}

describe('validate', () => {
  it('newly created chain should be valid', () => {
    const chain = create({ payload: { team: 'Spies Я Us' }, context })
    expect(validate(chain)).toBe(true)
  })
})
