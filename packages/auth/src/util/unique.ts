import type { ValueIteratee } from 'lodash'
import _uniqBy from 'lodash/uniqby'

export const unique = <T>(array: T[], fn: ValueIteratee<T> = _ => _) =>
  _uniqBy(array, fn)
