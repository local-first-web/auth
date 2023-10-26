// ignore coverage
export function truncateHashes(arg: any): any {
  console.log(arg)
  if (typeof arg === 'string') {
    const hashRx = /(?:[A-Za-z\d+/=]{32,9999999})?/g
    return arg.replaceAll(hashRx, s => s.slice(0, 5))
  }

  if (Array.isArray(arg)) {
    return arg.map(truncateHashes)
  }

  if (typeof arg === 'object') {
    const object = {} as any
    for (const prop in arg) {
      const value = arg[prop]
      object[truncateHashes(prop)] = truncateHashes(value)
    }

    return object
  }

  return arg
}
