import { type Base58 } from '../types.js'
import { encode, decode } from 'bs58'

export const base58 = {
  encode: (b: Uint8Array) => encode(b) as Base58,
  decode,
  detect: (s: string): s is Base58 =>
    /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(s),
}
