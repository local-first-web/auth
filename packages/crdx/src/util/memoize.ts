// ignore file coverage

import { memoize as _memoize } from 'lodash-es'

const BYPASS = false

export const nomemoize: Memoize = (f, _resolver) => f
export const memoize = (BYPASS ? nomemoize : _memoize) as Memoize

type AnyFn = (...args: any[]) => any
type Memoize = <F extends AnyFn>(f: F, _resolver?: (...args: Parameters<F>) => string) => F
