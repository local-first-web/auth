import type { ValueIteratee } from 'lodash'
import { uniqBy } from 'lodash-es'

export const unique = <T>(array: T[], fn: ValueIteratee<T> = _ => _) => uniqBy(array, fn)
