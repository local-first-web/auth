import { hash } from '@herbcaudill/crypto'
import { Link } from '/chain/types'

export const arbitraryDeterministicSort = (a: Link<any>[], b: Link<any>[]) => {
  const hashKey = 'DETERMINISTIC_SORT'
  return hash(hashKey, a[0].body.payload) > hash(hashKey, b[0].body.payload) ? 1 : -1
}
