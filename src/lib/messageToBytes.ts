import { Message } from '/lib/types'
import { utf8 } from '/lib/utf8'

export const messageToBytes = (x: Message) =>
  typeof x === 'string'
    ? utf8.encode(x) // string
    : x // Uint8Array
