import { arbitraryDeterministicSort } from '@/chain/arbitraryDeterministicSort'
import { Sequencer } from '@/chain/types'

export const arbitraryDeterministicSequencer: Sequencer = (a, b) => {
  const [_a, _b] = [a, b].sort(arbitraryDeterministicSort()) // ensure predictable order
  return _a.concat(_b)
}
