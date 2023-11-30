import { type RegexReplacer } from './debug.js'

// ignore coverage

export function truncateHashes<T>(arg: T): T {
  if (typeof arg === 'string') {
    const transforms: Array<[RegExp, string | RegexReplacer]> = [
      // strip ANSI color codes
      // eslint-disable-next-line no-control-regex
      [/\u001B\[\d+m/g, ''],
      // strip line feeds
      [/\\n/g, ''],
      // strip contents of Uint8Arrays
      [/(Uint8Array\(\d+\)) \[.+]/g, s => `${s.slice(0, 20)}...]`],
      // strip contents of Uint8Arrays expressed as objects
      [/({ ('\d+': \d+,?\s*)+})/g, s => `${s.slice(0, 20)}...}`],
      // strip buffers
      [/<(Buffer) ([a-f\d\s]+)>/g, s => `${s.slice(0, 20)}...>`],
      [/{"type":"Buffer","data":\[(\d+,?\s*)+]}/g, s => `${s.slice(0, 40)}...]}`],
    ]

    return transforms.reduce<string>(
      // @ts-expect-error I give up on trying to type this
      (acc, [rx, replacement]) => acc.replaceAll(rx, replacement),
      arg
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
