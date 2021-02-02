export function assert(value: boolean, message?: string): asserts value
export function assert<T>(value: T | null | undefined, message?: string): asserts value is T

export function assert(value: any, message?: string) {
  if (value === false || value === null || typeof value === 'undefined') {
    const error = new Error(message ?? 'Assertion failed')
    const stack = error.stack ?? ''
    error.stack = stack
      .split('\n')
      .filter((line) => !line.includes('assert.ts'))
      .join('\n')
    throw error
  }
}
