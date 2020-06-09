import { asymmetric, signatures, symmetric } from '/crypto'
import { create } from './create'
import { load } from './load'
import { expectToLookLikeKeyset } from '/team/tests/utils'

describe('user', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('instantiates a user', () => {
    const bob = create('bob')
    expect(bob.userName).toBe('bob')
    expect(bob).toHaveProperty('keys')
  })

  it('throws an error if we create the same user twice', () => {
    const createOnce = () => create('bob')
    const createTwice = () => create('bob')
    expect(createOnce).not.toThrow()
    expect(createTwice).toThrow()
  })

  it('throws an error if we try to load a nonexistent user', () => {
    const loadNonexistentUser = () => load('ned')
    expect(loadNonexistentUser).toThrow()
  })

  it('retrieves the keyset for a known user', () => {
    // bob uses app for the first time
    const bob1 = create('bob')
    const { keys } = bob1
    expectToLookLikeKeyset(keys)

    // bob uses app for the second time
    const bob2 = load('bob')

    // keyset is the same
    expect(bob2.keys).toEqual(keys)
  })

  it('keeps keysets separate for different users', () => {
    // bob uses app
    const bob = create('bob')

    // alice uses app on the same device
    // TODO is this actually a scenario we want to support?
    const alice = create('alice')

    // keyset is different
    expect(alice.keys).not.toEqual(bob.keys)
  })

  describe('keys', () => {
    const message = 'the crocodiles lunges at dawn'

    it('provides a working keypair for signatures', () => {
      const keypair = create('bob').keys.signature
      const { secretKey, publicKey } = keypair
      const signature = signatures.sign(message, secretKey)
      const signedMessage = { payload: message, signature, publicKey }
      expect(signatures.verify(signedMessage)).toBe(true)
    })

    it('provides a working keyset for encryption', () => {
      const charlie = create('charlie').keys.encryption
      const bob = asymmetric.keyPair()
      // Charlie encrypts a message for Bob
      const cipher = asymmetric.encrypt(message, bob.publicKey, charlie.secretKey)

      // Bob decrypts the message
      const decrypted = asymmetric.decrypt(cipher, charlie.publicKey, bob.secretKey)
      expect(decrypted).toEqual(message)
    })

    it('can use the secret half of the encryption key for symmetric encryption', () => {
      const { keys } = create('eve')
      const key = keys.encryption.secretKey
      const cipher = symmetric.encrypt(message, key)
      const decrypted = symmetric.decrypt(cipher, key)
      expect(decrypted).toEqual(message)
    })
  })
})
