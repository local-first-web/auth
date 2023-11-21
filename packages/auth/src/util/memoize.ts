// ignore file coverage

import { memoize as _memoize } from 'lodash-es'

const BYPASS = false

export const nomemoize = <T extends (...args: any[]) => any>(
  f: T,
  _resolver: (...args: Parameters<T>) => ReturnType<T>
) => f

export const memoize = (BYPASS ? nomemoize : _memoize) as typeof _memoize
