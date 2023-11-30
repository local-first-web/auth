import bs58 from 'bs58'
import { type Base58 } from '../types.js'

const { encode, decode } = bs58

export const base58 = {
  encode: (b: Uint8Array) => encode(b) as Base58,
  decode,
  detect: (s: string): s is Base58 =>
    /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(s),
}
