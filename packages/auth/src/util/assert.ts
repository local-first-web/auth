export function assert(value: boolean, message?: string): asserts value
export function assert<T>(value: T | null | undefined, message?: string): asserts value is T
export function assert(value: any, message: string = 'Assertion failed') {
  if (value === false || value === null || typeof value === 'undefined') {
    const error = new Error(trimLines(message))
    error.stack = removeLine(error.stack, 'assert.ts')
    throw error
  }
}

const trimLines = (s: string) =>
  s
    .split('\n')
    .map((s) => s.trim())
    .join('\n')

const removeLine = (s: string = '', targetText: string) =>
  s
    .split('\n')
    .filter((line) => !line.includes(targetText))
    .join('\n')
