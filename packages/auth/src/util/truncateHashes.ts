// ignore coverage
export function truncateHashes<T>(arg: T, i = 0): T {
  if (i > 10) return arg
  if (typeof arg === 'string') {
    const hashRx = /(?:[A-Za-z\d+/=]{32,9999999})?/g
    return arg.replaceAll(hashRx, s => s.slice(0, 5)) as T
  }

  if (Array.isArray(arg)) {
    return arg.map(x => truncateHashes(x, i++)) as T
  }

  if (typeof arg === 'object') {
    const object = {} as Partial<T>
    for (const prop in arg) {
      const value = arg[prop]
      object[truncateHashes(prop)] = truncateHashes(value, i++)
    }

    return object as T
  }

  return arg
}
