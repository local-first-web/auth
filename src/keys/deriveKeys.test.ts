import { signatures, asymmetric, symmetric } from '/crypto'
import { keyToBytes } from '/lib'
import { deriveKeys } from '/keys/deriveKeys'
import { randomKey } from '/keys/randomKey'

describe('deriveKeys', () => {
  it('should return keys with the expected lengths', () => {
    const secretKey = randomKey()
    const derivedKeys = deriveKeys(secretKey)

    const { signature, encryption } = derivedKeys

    // signature keys look right
    expect(keyToBytes(signature.publicKey)).toHaveLength(32)
    expect(keyToBytes(signature.secretKey)).toHaveLength(64)

    // encryption keys look right
    expect(keyToBytes(encryption.publicKey)).toHaveLength(32)
    expect(keyToBytes(encryption.secretKey)).toHaveLength(32)
  })

  it('produces working signature keys', () => {
    const derivedKeys = deriveKeys()
    const { secretKey, publicKey } = derivedKeys.signature

    // Alice signs a message
    const payload = 'if you plant corn you get corn'
    const signature = signatures.sign(payload, secretKey)

    // Bob checks it
    const isLegit = signatures.verify({ payload, signature, publicKey })
    expect(isLegit).toBe(true)
  })

  it('produces working keys for asymmetric encryption', () => {
    const message = 'The dolphin leaps at twilight'
    const alice = deriveKeys().encryption
    const bob = deriveKeys().encryption

    // Alice encrypts a message for Bob
    const encrypted = asymmetric.encrypt(message, bob.publicKey, alice.secretKey)

    // Bob decrypts it
    const decrypted = asymmetric.decrypt(encrypted, alice.publicKey, bob.secretKey)
    expect(decrypted).toEqual(message)
  })
})
