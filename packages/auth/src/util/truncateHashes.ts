export function truncateHashes(arg: any) {
  if (typeof arg === 'string') {
    const str = arg as string
    const hashRx = /(?:[A-Za-z0-9+/=]{32,100})?/g
    return str.replace(hashRx, s => s.slice(0, 5))
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
