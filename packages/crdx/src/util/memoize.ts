// ignore file coverage
import _memoize from 'fast-memoize'
import { MemoizeFunc } from 'fast-memoize/typings/fast-memoize'

const BYPASS = false

const passthrough = <T>(f: T) => f as T

export const memoize = (BYPASS ? passthrough : _memoize) as MemoizeFunc
