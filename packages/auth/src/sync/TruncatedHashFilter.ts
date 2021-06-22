import { Hash } from '@/util'
import { base64, hash } from '@herbcaudill/crypto'
import { ProbabilisticFilter } from './ProbabilisticFilter'

interface TruncatedHashFilterOptions {
  resolution?: number
}

export class TruncatedHashFilter extends ProbabilisticFilter {
  resolution: number = 4
  hashes: Set<string>

  constructor(options: TruncatedHashFilterOptions = {}) {
    super()
    if (options.resolution !== undefined) this.resolution = options.resolution
    this.hashes = new Set()
  }

  addHashes(hashes: Hash | Hash[]) {
    if (!Array.isArray(hashes)) hashes = [hashes]
    for (const hash of hashes) {
      this.hashes.add(this.truncateHash(hash))
    }
    return this
  }

  hasHash(hash: string) {
    return this.hashes.has(this.truncateHash(hash))
  }

  save() {
    const encodedValue = this.encode(this.hashes)
    return encodedValue
  }

  load(encodedValue: Uint8Array) {
    const decodedValue = this.decode(encodedValue)
    this.hashes = decodedValue
    return this
  }

  private encode(decodedValue: Set<string>) {
    const encodedValue = new Uint8Array(decodedValue.size * this.resolution)
    let offset = 0
    for (const hash of decodedValue) {
      const bytes = Buffer.from(hash, 'hex')
      encodedValue.set(bytes, offset)
      offset += this.resolution
    }
    return encodedValue
  }

  private decode(encodedValue: Uint8Array): Set<string> {
    let offset = 0
    const decodedValue = new Set<string>()
    while (offset < encodedValue.length) {
      const bytes = encodedValue.subarray(offset, offset + this.resolution)
      const hash = Buffer.from(bytes).toString('hex')
      decodedValue.add(hash)
      offset += this.resolution
    }
    return decodedValue
  }

  private truncateHash(hash: Hash): Hash {
    const bytes = Buffer.from(base64.decode(hash))
    return bytes.slice(0, this.resolution).toString('hex')
  }
}
