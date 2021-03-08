import _memoize from 'fast-memoize'
import { MemoizeFunc } from 'fast-memoize/typings/fast-memoize'

// ignore file coverage

const BYPASS = false

const passthrough = <T>(f: T) => f as T

export const memoize = (BYPASS ? passthrough : _memoize) as Memoize

// types that are not exported from fast-memoize

type Func = (...args: any[]) => any

interface Memoize extends MemoizeFunc {
  strategies: {
    variadic: MemoizeFunc
    monadic: MemoizeFunc
  }
}
