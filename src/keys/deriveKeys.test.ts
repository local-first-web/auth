import { deriveKeys } from './deriveKeys'
import { keyToBytes } from '../lib'
import { randomKey } from './randomKey'

describe('deriveKeys', () => {
  it('should return keys with the expected lengths', () => {
    const secretKey = randomKey()
    const derivedKeys = deriveKeys(secretKey)
    const { signature, asymmetric, symmetric } = derivedKeys
    expect(keyToBytes(signature.publicKey)).toHaveLength(32)
    expect(keyToBytes(signature.secretKey)).toHaveLength(64)
    expect(keyToBytes(asymmetric.publicKey)).toHaveLength(32)
    expect(keyToBytes(asymmetric.secretKey)).toHaveLength(32)
    expect(keyToBytes(symmetric.key)).toHaveLength(32)
  })
})
