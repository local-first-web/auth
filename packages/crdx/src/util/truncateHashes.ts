// ignore coverage
export function truncateHashes<T>(arg: T): T {
  if (typeof arg === "string") {
    const str = arg
    const hashRx = /(?:[A-Za-z\d+/=]{32,100})?/g
    return str.replaceAll(hashRx, s => s.slice(0, 5)) as T
  }

  if (Array.isArray(arg)) {
    return arg.map(x => truncateHashes(x) as T) as T
  }

  if (typeof arg === "object") {
    const obj = {} as T
    for (const prop in arg) {
      const value = arg[prop]
      obj[truncateHashes(prop)] = truncateHashes(value)
    }

    return obj
  }

  return arg
}
