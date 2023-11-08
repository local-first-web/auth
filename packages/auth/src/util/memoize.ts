import memize from 'memize'

// ignore file coverage

const BYPASS = false

const passthrough = <T>(f: T) => f

export const memoize = (BYPASS ? passthrough : memize) as typeof memize
