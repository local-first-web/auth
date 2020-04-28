import * as utf8 from '@stablelib/utf8'
import { Message } from 'types'

export const maybeUtf8 = (x: Message) =>
  typeof x === 'string'
    ? utf8.encode(x) // string
    : ArrayBuffer.isView(x)
    ? x // Uint8Array
    : utf8.encode(JSON.stringify(x)) // object
