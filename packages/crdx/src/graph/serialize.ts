import { pack, unpack } from 'msgpackr'
import { decryptGraph } from './decrypt.js'
import { redactGraph } from './redactGraph.js'
import { type MaybePartlyDecryptedGraph, type Action, type Graph } from './types.js'
import { type Keyring, type KeysetWithSecrets } from '../keyset/index.js'

/**
 * Returns the graph as bytes.
 *
 * Declared as `Uint8Array` rather than msgpackr's `Buffer`, which is what keeps `@types/node` out
 * of the published types — publishing `Buffer` makes every browser consumer install them.
 *
 * Note the direction: `Buffer extends Uint8Array`, so this *widens* the declared return type, which
 * is the breaking one. `serialize(graph).toString('base64')` no longer compiles, though the value
 * is byte-for-byte what it always was.
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
