import * as utf8 from '@stablelib/utf8'
import * as base64 from '@stablelib/base64'
import { Key } from '/lib'

export const keyToString = (x: Key, encoding: Encoding = 'base64') => {
  const encode = encoding === 'base64' ? base64.encode : utf8.decode
  return typeof x === 'string' ? x : encode(x)
}

type Encoding = 'base64' | 'utf8'
