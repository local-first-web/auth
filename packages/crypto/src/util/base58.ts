import { type Buffer } from "node:buffer"
import { base58 as _base58 } from "@herbcaudill/base-x"
import { type Base58 } from "../types.js"

export const base58 = {
  encode: _base58.encode as (b: Uint8Array) => Base58,
  decode(s: string) {
    const b = _base58.decode(s)
    return bufferToArray(b)
  },
  detect: (s: string): s is Base58 =>
    /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(s),
}

// https://stackoverflow.com/a/31394257/239663
function bufferToArray(b: Buffer) {
  return new Uint8Array(
    b.buffer,
    b.byteOffset,
    b.byteLength / Uint8Array.BYTES_PER_ELEMENT
  )
}
