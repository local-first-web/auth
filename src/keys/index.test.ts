import { deriveKeys } from '.'
import nacl from 'tweetnacl'
import { keyToBytes } from '../lib'

describe('deriveKeys', () => {
  it('should return keys with the expected lengths', () => {
    const secretKey = nacl.randomBytes(32)
    const derivedKeys = deriveKeys(secretKey)
    const { signature, asymmetric, symmetric } = derivedKeys
    expect(keyToBytes(signature.publicKey)).toHaveLength(32)
    expect(keyToBytes(signature.secretKey)).toHaveLength(64)
    expect(keyToBytes(asymmetric.publicKey)).toHaveLength(32)
    expect(keyToBytes(asymmetric.secretKey)).toHaveLength(32)
    expect(keyToBytes(symmetric.key)).toHaveLength(32)
  })
})
