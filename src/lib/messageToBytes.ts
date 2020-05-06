import { Message } from 'lib/types'

export const messageToBytes = (x: Message) =>
  typeof x === 'string'
    ? Buffer.from(x) // string
    : x // Uint8Array
