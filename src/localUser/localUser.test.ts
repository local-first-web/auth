import { asymmetric, signatures, symmetric } from '/crypto'
import { localUser } from './index'
import { expectToLookLikeKeyset } from '/team/tests/utils'

describe('localUser', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('creates a new user', () => {
    const bob = localUser('bob')
    expect(bob.userName).toBe('bob')
    expect(bob).toHaveProperty('keys')
  })

  it('loads an existing user', () => {
    // Bob uses app for the first time
    const bob1 = localUser('bob')
    const { keys } = bob1
    expectToLookLikeKeyset(keys)

    // Bob uses app for the second time
    const bob2 = localUser('bob')
    expect(bob2.userName).toBe('bob')
    expect(bob2).toHaveProperty('keys')
    // keyset is the same
    expect(bob2.keys).toEqual(keys)
  })

  it('keeps keysets separate for different users', () => {
    // Bob uses app
    const bob = localUser('bob')

    // Alice uses app on the same device
    // TODO is this actually a scenario we want to support?
    const alice = localUser('alice')

    // keyset is different
    expect(alice.keys).not.toEqual(bob.keys)
  })

  describe('working keys', () => {
    const message = 'the crocodile lunges at dawn'

    it('provides a working keypair for signatures', () => {
      const keypair = localUser('bob').keys.signature
      const { secretKey, publicKey } = keypair
      const signature = signatures.sign(message, secretKey)
      const signedMessage = { payload: message, signature, publicKey }
      expect(signatures.verify(signedMessage)).toBe(true)
    })

    it('provides a working keyset for encryption', () => {
      const charlie = localUser('charlie').keys.encryption
      const bob = asymmetric.keyPair()
      // Charlie encrypts a message for Bob
      const cipher = asymmetric.encrypt(message, bob.publicKey, charlie.secretKey)

      // Bob decrypts the message
      const decrypted = asymmetric.decrypt(cipher, charlie.publicKey, bob.secretKey)
      expect(decrypted).toEqual(message)
    })

    it('can use the secret half of the encryption key for symmetric encryption', () => {
      const { keys } = localUser('eve')
      const key = keys.encryption.secretKey
      const cipher = symmetric.encrypt(message, key)
      const decrypted = symmetric.decrypt(cipher, key)
      expect(decrypted).toEqual(message)
    })
  })
})
