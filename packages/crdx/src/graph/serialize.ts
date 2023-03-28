import { decryptGraph } from './decrypt'
import { redactGraph } from './redactGraph'
import { Action, Graph } from './types'
import { Keyring, KeysetWithSecrets } from '/keyset'

export const serialize = <A extends Action, C>(graph: Graph<A, C>) => {
  return JSON.stringify(redactGraph(graph))
}

export const deserialize = <A extends Action, C>(
  serialized: string,
  keys: KeysetWithSecrets | Keyring
): Graph<A, C> => {
  const encryptedGraph = JSON.parse(serialized)

  return decryptGraph({ encryptedGraph, keys })
}
