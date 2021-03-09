import { hash } from '@herbcaudill/crypto'
import { Link } from '@/chain/types'

export const arbitraryDeterministicSort = (hashKey = 'DETERMINISTIC_SORT') => (
  a: Link<any>[],
  b: Link<any>[]
) => (hash(hashKey, a) > hash(hashKey, b) ? 1 : -1)
