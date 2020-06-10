import * as utf8 from '@stablelib/utf8'
import * as base64 from '@stablelib/base64'
import { Key } from '/util'

export const keyToBytes = (x: Key, encoding: Encoding = 'base64') => {
  const decode = encoding === 'base64' ? base64.decode : utf8.encode
  return typeof x === 'string' ? decode(x) : x
}

type Encoding = 'base64' | 'utf8'
