import { base58 } from './base58.js'

export const keyToBytes = (x: string, encoding: Encoding = 'base58'): Uint8Array => {
  if (encoding === 'utf8') {
    return new TextEncoder().encode(x)
  }

  if (encoding === 'base58') {
    return base58.decode(x)
  }

  throw new Error(`Unknown encoding: ${encoding as string}`)
}

type Encoding = 'base58' | 'utf8'
