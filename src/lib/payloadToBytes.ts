import stringify from 'json-stable-stringify'
import { Payload } from 'lib/types'

/** Takes either a string, a byte array, or a javascript object, and returns it as a byte array */
export const payloadToBytes = (x: Payload): Uint8Array =>
  typeof x === 'string'
    ? // string
      Buffer.from(x)
    : ArrayBuffer.isView(x)
    ? // byte array
      x
    : // object
      Buffer.from(stringify(x))
