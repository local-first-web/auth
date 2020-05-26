import { asymmetric, signatures, symmetric } from '/crypto'
import { create } from '/user/create'
import { load } from '/user/load'

describe('user', () => {
  const message = 'the crocodiles lunges at dawn'

  beforeEach(() => {
    localStorage.clear()
  })

  it('should instantiate a user', () => {
    const bob = create('bob')
    expect(bob).toHaveProperty('keys')
  })

  it('should throw an error if we create the same user twice', () => {
    const _bob1 = create('bob')
    const duplicateCreation = () => {
      const _bob2 = create('bob')
    }
    expect(duplicateCreation).toThrow()
  })

  it('should throw an error if we try to load a nonexistent user', () => {
    const failedLoad = () => {
      const _ = load('ned')
    }
    expect(failedLoad).toThrow()
  })

  it('should retrieve the keyset for a known user', () => {
    // bob uses app for the first time
    const bob1 = create('bob')
    const { keys } = bob1
    expect(keys).toHaveProperty('signature')
    expect(keys).toHaveProperty('encryption')

    // bob uses app for the second time
    const bob2 = load('bob')

    // keyset is the same
    expect(bob2.keys).toEqual(keys)
  })

  it('should keep keysets separate for different users', () => {
    // bob uses app
    const bob = create('bob')

    // alice uses app on the same device
    // TODO is this actually a scenario we want to support?
    const alice = create('alice')

    // keyset is different
    expect(alice.keys).not.toEqual(bob.keys)
  })

  it('should provide a working keypair for signatures', () => {
    const keypair = create('bob').keys.signature
    const { secretKey, publicKey } = keypair
    const signature = signatures.sign(message, secretKey)
    const signedMessage = { payload: message, signature, publicKey }
    expect(signatures.verify(signedMessage)).toBe(true)
  })

  it('should provide a working keyset for encryption', () => {
    const charlie = create('charlie').keys.encryption
    const bob = asymmetric.keyPair()
    // Charlie encrypts a message for Bob
    const cipher = asymmetric.encrypt(message, bob.publicKey, charlie.secretKey)

    // Bob decrypts the message
    const decrypted = asymmetric.decrypt(cipher, charlie.publicKey, bob.secretKey)
    expect(decrypted).toEqual(message)
  })

  it('supports using the secret half of the encryption key for symmetric encryption', () => {
    const { keys } = create('eve')
    const key = keys.encryption.secretKey
    const cipher = symmetric.encrypt(message, key)
    const decrypted = symmetric.decrypt(cipher, key)
    expect(decrypted).toEqual(message)
  })
})
