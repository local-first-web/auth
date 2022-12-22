import { Action, Graph } from 'crdx'

export function getMissingLinks<A extends Action, C>(chain: Graph<A, C>) {
  const parentHashes = Object.values(chain.links) //
    .flatMap(link => link.body.prev) as string[]
  return parentHashes //
    .concat([chain.root, ...chain.head])
    .filter(hash => !(hash in chain.links))
}
