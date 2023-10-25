// ignore file coverage
import _memoize from 'fast-memoize'
import type { MemoizeFunc } from 'fast-memoize'

const BYPASS = false

const passthrough = <T>(f: T) => f

export const memoize = (BYPASS ? passthrough : _memoize) as MemoizeFunc
