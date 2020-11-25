import { arbitraryDeterministicSort } from '/chain/arbitraryDeterministicSort'
import { Resolver } from '/chain/types'
import { TeamAction } from '/team/types'

export const strongRemoveResolver: Resolver<TeamAction> = (a = [], b = []) => {
  const [_a, _b] = [a, b].sort(arbitraryDeterministicSort()) // ensure predictable order
  return _a.concat(_b)
}
