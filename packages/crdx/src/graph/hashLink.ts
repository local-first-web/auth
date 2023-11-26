import { type Base58, type Hash, hash } from '@localfirst/crypto'
import { HashPurpose } from 'constants.js'

const { LINK_HASH } = HashPurpose

export const hashEncryptedLink = (body: Uint8Array) => {
  return hash(LINK_HASH, body) as Hash
}
