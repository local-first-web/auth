export function truncateHashes<T>(arg: T): T {
  if (typeof arg === 'string') {
    const str = arg as string
    const hashRx = /(?:[A-Za-z0-9+/=]{32,9999999})?/g
    return str.replace(hashRx, s => s.slice(0, 5)) as T
  } else if (Array.isArray(arg)) {
    return arg.map(truncateHashes) as T
  } else if (typeof arg === 'object') {
    const obj = {} as any
    for (const prop in arg) {
      const value = arg[prop]
      obj[truncateHashes(prop)] = truncateHashes(value)
    }
    return obj
  } else {
    return arg
  }
}
