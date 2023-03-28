import { createGraph, deserialize, getHead, getRoot, serialize } from '/graph'
import '/test/helpers/expect/toBeValid'
import { setup, TEST_GRAPH_KEYS as keys } from '/test/helpers/setup'
import { validate } from '/validator'

const { alice } = setup('alice')
const defaultUser = alice

const __ = expect.objectContaining

describe('graphs', () => {
  test('create', () => {
    const graph = createGraph({ user: defaultUser, name: 'a', keys })
    const expected = __({ body: __({ payload: __({ name: 'a' }) }) })
    expect(getRoot(graph)).toEqual(expected)
    expect(getHead(graph)[0]).toEqual(expected)
  })

  test('serialize/deserialize', () => {
    // 👨🏻‍🦲 Bob saves a graph to a file and loads it later
    const graph = createGraph({ user: defaultUser, name: 'Spies Я Us', keys })

    // serialize
    const graphJson = serialize(graph)

    // deserialize
    const rehydratedGraph = deserialize(graphJson, keys)

    expect(validate(rehydratedGraph)).toBeValid()
  })
})
