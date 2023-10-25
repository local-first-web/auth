import _memoize from 'fast-memoize'
import { type MemoizeFunc } from 'fast-memoize/typings/fast-memoize'

// ignore file coverage

const BYPASS = false

const passthrough = <T>(f: T) => f

export const memoize = (BYPASS ? passthrough : _memoize) as Memoize

// Types that are not exported from fast-memoize

type Memoize = {
  strategies: {
    variadic: MemoizeFunc
    monadic: MemoizeFunc
  }
} & MemoizeFunc
