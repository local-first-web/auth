import { TEST_GRAPH_KEYS as keys, setup } from '_test/helpers/setup.js'
import { describe, expect, test } from 'vitest'
import { append, createGraph, getHead, getRoot } from 'graph/index.js'
import { validate } from 'validator/index.js'
import '_test/helpers/expect/toBeValid'

const { alice } = setup('alice')
const defaultUser = alice

const _ = expect.objectContaining

describe('graphs', () => {
  test('append', () => {
    const graph1 = createGraph({ user: defaultUser, name: 'a', keys })
    const graph2 = append({
      graph: graph1,
      action: { type: 'FOO', payload: 'b' },
      user: defaultUser,
      keys,
    })

    expect(validate(graph2)).toBeValid()

    expect(getRoot(graph2)).toEqual(_({ body: _({ payload: _({ name: 'a' }) }) }))
    expect(getHead(graph2)).toEqual([_({ body: _({ payload: 'b' }) })])
  })
})
