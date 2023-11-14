// ignore file coverage
import memize from 'memize'

const BYPASS = false

const passthrough = <T>(f: T) => f

export const memoize = (BYPASS ? passthrough : memize) as typeof memize
