import { create, validate } from '.'
import { Context, DeviceType, LocalUser } from './types'
import { deriveKeys, randomKey } from '../keys'
import { payloadToBytes, signatures } from '../lib'

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
    const payloadBytes = payloadToBytes(chain[0].body)
    const validationResult = validate(chain)
    console.log(payloadBytes)

    expect(validationResult.isValid).toBe(true)
  })
})
