import { asymmetric, signatures, symmetric } from '/crypto'
import { user } from './index'
import { expectToLookLikeKeyset } from '/team/tests/utils'

describe('user', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('creates a new user', () => {
    const bob = user('bob')
    expect(bob.userName).toBe('bob')
    expect(bob).toHaveProperty('keys')
  })

  it('loads an existing user', () => {
    // Bob uses app for the first time
    const bob1 = user('bob')
    const { keys } = bob1
    expectToLookLikeKeyset(keys)

    // Bob uses app for the second time
    const bob2 = user('bob')
    expect(bob2.userName).toBe('bob')
    expect(bob2).toHaveProperty('keys')
    // keyset is the same
    expect(bob2.keys).toEqual(keys)
  })

  it('keeps keysets separate for different users', () => {
    // Bob uses app
    const bob = user('bob')

    // Alice uses app on the same device
    // TODO is this actually a scenario we want to support?
    const alice = user('alice')

    // keyset is different
    expect(alice.keys).not.toEqual(bob.keys)
  })

  describe('working keys', () => {
    const message = 'the crocodile lunges at dawn'

    it('provides a working keypair for signatures', () => {
      const keypair = user('bob').keys.signature
      const { secretKey, publicKey } = keypair
      const signature = signatures.sign(message, secretKey)
      const signedMessage = { payload: message, signature, publicKey }
      expect(signatures.verify(signedMessage)).toBe(true)
    })

    it('provides a working keyset for encryption', () => {
      const charlie = user('charlie').keys.encryption
      const bob = asymmetric.keyPair()
      // Charlie encrypts a message for Bob
      const cipher = asymmetric.encrypt(message, bob.publicKey, charlie.secretKey)

      // Bob decrypts the message
      const decrypted = asymmetric.decrypt(cipher, charlie.publicKey, bob.secretKey)
      expect(decrypted).toEqual(message)
    })

    it('can use the secret half of the encryption key for symmetric encryption', () => {
      const { keys } = user('eve')
      const key = keys.encryption.secretKey
      const cipher = symmetric.encrypt(message, key)
      const decrypted = symmetric.decrypt(cipher, key)
      expect(decrypted).toEqual(message)
    })
  })
})
