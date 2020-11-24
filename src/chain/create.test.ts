import { create, deserialize, getHead, getRoot, serialize, validate } from '/chain'
import { defaultContext } from '/util/testing'
import '/util/testing/expect/toBeValid'

const __ = expect.objectContaining

describe('chains', () => {
  test('create', () => {
    const chain = create('a', defaultContext)
    expect(getRoot(chain)).toEqual(__({ body: __({ payload: 'a' }) }))
    expect(getHead(chain)).toEqual(__({ body: __({ payload: 'a' }) }))
  })

  test('persistence', () => {
    // 👨‍🦲 Bob saves a chain to a file and loads it later
    const chain = create({ team: 'Spies Я Us' }, defaultContext)

    // serialize
    const chainJson = serialize(chain)

    // deserialize
    const rehydratedChain = deserialize(chainJson)

    expect(validate(rehydratedChain)).toBeValid()
  })
})
