import { RegexReplacer } from './debug.js'

// ignore coverage

export function truncateHashes<T>(arg: T): T {
  if (typeof arg === 'string') {
    const transforms: [RegExp, string | RegexReplacer][] = [
      // strip ANSI color codes
      [/\x1B\[\d+m/g, ''],
      // strip line feeds
      [/\\n/g, ''],
      // strip contents of Uint8Arrays
      [/(Uint8Array\(\d+\)) \[.+\]/g, s => `${s.slice(0, 20)}...]`],
      // strip contents of Uint8Arrays expressed as objects
      [/(\{ ('\d+': \d+,?\s*)+\})/g, s => `${s.slice(0, 20)}...}`],
      // strip buffers
      [/<(Buffer) ([a-f0-9\s]+)>/g, s => `${s.slice(0, 20)}...>`],
      [/\{"type":"Buffer","data":\[(\d+,?\s*)+\]\}/g, s => `${s.slice(0, 40)}...]}`],
    ]

    return transforms.reduce(
      // @ts-ignore
      (acc, [rx, replacement]) => acc.replaceAll(rx, replacement),
      arg as string
    ) as T
  }

  if (Array.isArray(arg)) {
    return arg.map(truncateHashes) as T
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
