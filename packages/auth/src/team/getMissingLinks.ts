import { Action, SignatureChain } from 'crdx'

export function getMissingLinks<A extends Action, C>(chain: SignatureChain<A, C>) {
  const parentHashes = Object.values(chain.links) //
    .flatMap(link => link.body.prev) as string[]
  return parentHashes //
    .concat([chain.root, ...chain.head])
    .filter(hash => !(hash in chain.links))
}
