import { decryptGraph } from './decrypt.js'
import { redactGraph } from './redactGraph.js'
import { type MaybePartlyDecryptedGraph, type Action, type Graph } from './types.js'
import { type Keyring, type KeysetWithSecrets } from '@/keyset/index.js'

export const serialize = <A extends Action, C>(graph: Graph<A, C>) => {
  return JSON.stringify(redactGraph(graph))
}

export const deserialize = <A extends Action, C>(
  serialized: string,
  keys: KeysetWithSecrets | Keyring
): Graph<A, C> => {
  const graph = JSON.parse(serialized) as MaybePartlyDecryptedGraph<A, C>
  return decryptGraph({ encryptedGraph: graph, keys })
}
