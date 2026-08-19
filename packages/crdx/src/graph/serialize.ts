import { pack, unpack } from 'msgpackr'
import { decryptGraph } from './decrypt.js'
import { redactGraph } from './redactGraph.js'
import { type MaybePartlyDecryptedGraph, type Action, type Graph } from './types.js'
import { type Keyring, type KeysetWithSecrets } from '../keyset/index.js'

/**
 * Returns the graph as bytes. Typed as `Uint8Array` rather than msgpackr's `Buffer` on purpose:
 * `Buffer` would drag `@types/node` into the published types, and no caller needs the difference.
 */
export const serialize = <A extends Action, C>(graph: Graph<A, C>): Uint8Array => {
  return pack(redactGraph(graph))
}

export const deserialize = <A extends Action, C>(
  serialized: Uint8Array,
  keys: KeysetWithSecrets | Keyring
): Graph<A, C> => {
  const graph = unpack(serialized) as MaybePartlyDecryptedGraph<A, C>
  return decryptGraph({ encryptedGraph: graph, keys })
}
