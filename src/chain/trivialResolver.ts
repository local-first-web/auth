import { Resolver } from '/chain/types'
import { arbitraryDeterministicSort } from './arbitraryDeterministicSort'

/// If no resolver is provided, we just concatenate the two sequences in an arbitrary but deterministic manner
export const trivialResolver: Resolver = (a = [], b = []) => {
  const [_a, _b] = [a, b].sort(arbitraryDeterministicSort) // ensure predictable order
  return _a.concat(_b)
}
