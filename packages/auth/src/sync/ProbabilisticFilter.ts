import { Hash } from '@/util'
import { base64, hash } from '@herbcaudill/crypto'

export abstract class ProbabilisticFilter {
  constructor() {}

  add(values: string[] | number[]) {
    const hashes = values.map((value: string | number) => makeHash(value))
    this.addHashes(hashes)
    return this
  }

  abstract addHashes(hashes: Hash[]): ProbabilisticFilter

  has(value: string | number) {
    return this.hasHash(makeHash(value))
  }

  abstract hasHash(hash: Hash): boolean

  abstract save(): Uint8Array
  abstract load(encodedValue: Uint8Array): ProbabilisticFilter
}

export const makeHash = (s: string | number) =>
  base64.encode(hash('ProbabilisticFilter', s.toString()))
