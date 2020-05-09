import { Message } from './types'
import { utf8 } from './utf8'

export const messageToBytes = (x: Message) =>
  typeof x === 'string'
    ? utf8.encode(x) // string
    : x // Uint8Array
