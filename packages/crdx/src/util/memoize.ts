// ignore file coverage

import { memoize as _memoize } from 'lodash-es'

const BYPASS = false

export const nomemoize = <T>(f: T, _resolver: (...args: Parameters<T>) => any) => f

export const memoize = (BYPASS ? nomemoize : _memoize) as typeof _memoize
