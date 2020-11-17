import { append, create } from '/chain'
import { getHead } from '/chain/getHead'
import { getRoot } from '/chain/getRoot'
import { defaultContext } from '/util/testing'
import '/util/testing/expect/toBeValid'

const __ = expect.objectContaining

describe('chains', () => {
  test('append', () => {
    const chain1 = create('a', defaultContext)
    const chain2 = append(chain1, { type: 'FOO', payload: 'b' }, defaultContext)
    expect(getRoot(chain2)).toEqual(__({ body: __({ payload: 'a' }) }))
    expect(getHead(chain2)).toEqual(__({ body: __({ payload: 'b' }) }))
  })
})
