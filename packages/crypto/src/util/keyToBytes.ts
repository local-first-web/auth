import { base58 } from './base58'

export const keyToBytes = (x: string, encoding: Encoding = 'base58'): Uint8Array => {
  if (encoding === 'utf8') {
    return new TextEncoder().encode(x)
  } else if (encoding === 'base58') {
    return base58.decode(x)
  } else {
    throw new Error(`Unknown encoding: ${encoding}`)
  }
}

type Encoding = 'base58' | 'utf8'
