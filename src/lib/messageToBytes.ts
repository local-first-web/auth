import * as utf8 from '@stablelib/utf8'
import { Message } from 'types'

export const messageToBytes = (x: Message) =>
  typeof x === 'string'
    ? utf8.encode(x) // string
    : x // Uint8Array
