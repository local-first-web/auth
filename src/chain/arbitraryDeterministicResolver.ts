import { getCommonPredecessor } from './predecessors'
import { arbitraryDeterministicSort } from '/chain/arbitraryDeterministicSort'
import { Resolver } from '/chain/types'

export const arbitraryDeterministicResolver: Resolver<any> = (a, b) => {
  const [_a, _b] = [a, b].sort(arbitraryDeterministicSort()) // ensure predictable order
  return _a.concat(_b)
}
