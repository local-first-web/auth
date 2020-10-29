import { create, getHead, getRoot, append } from '/graph'
import { defaultContext } from '/util/testing'

describe('SignatureGraph', () => {
  test('a', () => {
    const graph = create('a', defaultContext)
    expect(getRoot(graph).body.payload).toEqual('a')
    expect(getHead(graph).body.payload).toEqual('a')
  })

  test('a -> b', () => {
    const graph1 = create('a', defaultContext)
    const graph2 = append(graph1, { type: 'FOO', payload: 'b' }, defaultContext)
    expect(getRoot(graph2).body.payload).toEqual('a')
    expect(getHead(graph2).body.payload).toEqual('b')
  })
})
