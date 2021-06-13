import { Hash } from '@/util'
import { sha256 as hash } from 'js-sha256'

export abstract class ProbabilisticFilter {
  constructor() {}

  add(values: string[] | number[]) {
    const hashes = values.map((value: string | number) => hash(value.toString()))
    this.addHashes(hashes)
    return this
  }

  abstract addHashes(hashes: Hash[]): ProbabilisticFilter

  has(value: string | number) {
    return this.hasHash(hash(value.toString()))
  }

  abstract hasHash(hash: Hash): boolean

  abstract save(): Uint8Array
  abstract load(encodedValue: Uint8Array): ProbabilisticFilter
}
