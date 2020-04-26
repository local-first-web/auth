import { LocalUser } from './LocalUser'
import { signatures, asymmetric, symmetric } from './lib'

describe('LocalUser', () => {
  const message = 'the crocodiles lunges at dawn'

  beforeEach(() => {
    localStorage.clear()
  })

  describe('constructor', () => {
    it('should instantiate a user', () => {
      const herb = new LocalUser({ username: 'herb' })
      expect(herb).toHaveProperty('keyset')
    })

    it('should retrieve the keyset for a known user', () => {
      // herb uses app for the first time
      const herb1 = new LocalUser({ username: 'herb' })
      const { keyset } = herb1
      expect(keyset).toHaveProperty('signature')
      expect(keyset).toHaveProperty('asymmetric')
      expect(keyset).toHaveProperty('symmetric')

      // herb uses app for the second time
      const herb2 = new LocalUser({ username: 'herb' })

      // keyset is the same
      expect(herb2.keyset).toEqual(keyset)
    })

    it('should keep keysets separate for different users', () => {
      // herb uses app
      const herb = new LocalUser({ username: 'herb' })

      // alice uses app on the same device (?)
      const alice = new LocalUser({ username: 'alice' })

      // keyset is different
      expect(alice.keyset).not.toEqual(herb.keyset)
    })

    it('should provide a working keypair for signatures', () => {
      const keypair = new LocalUser({ username: 'bob' }).keyset.signature
      const { secretKey, publicKey } = keypair
      const signature = signatures.sign(message, secretKey)
      expect(
        signatures.verify({ content: message, signature, publicKey })
      ).toBe(true)
    })

    it('should provide a working keyset for asymmetric encryption', () => {
      const a = new LocalUser({ username: 'charlie' }).keyset.asymmetric
      const b = asymmetric.keyPair()
      const cipher = asymmetric.encrypt(message, b.publicKey, a.secretKey)
      const decrypted = asymmetric.decrypt(cipher, a.publicKey, b.secretKey)
      expect(decrypted).toEqual(message)
    })

    it('should provide a working key for symmetric encryption', () => {
      const { keyset } = new LocalUser({ username: 'eve' })
      const key = keyset.symmetric
      const cipher = symmetric.encrypt(message, key)
      const decrypted = symmetric.decrypt(cipher, key)
      expect(decrypted).toEqual(message)
    })
  })
})
