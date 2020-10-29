import { SignatureGraph } from './SignatureGraph'
import { alice, defaultContext } from '/util/testing'

describe('SignatureGraph', () => {
  test('constructor', () => {
    const graph = new SignatureGraph('a', defaultContext)
    expect(graph.getHead().body.payload).toEqual('a')
  })

  test('append', () => {
    const graph = new SignatureGraph('a', defaultContext)
    graph.append({ type: 'FOO', payload: 'b' })
    expect(graph.getHead().body.payload).toEqual('b')
  })
})
