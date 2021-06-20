import { Action, getParentHashes, SignatureChain } from '@/chain'

export function getMissingLinks<A extends Action>(chain: SignatureChain<A>) {
  const parentHashes = Object.values(chain.links) //
    .flatMap(link => getParentHashes(link)) as string[]
  return parentHashes
    .concat([chain.root, chain.head]) // make sure
    .filter(hash => !(hash in chain.links))
}
