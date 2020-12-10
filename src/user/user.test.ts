import { asymmetric, signatures, symmetric } from '@herbcaudill/crypto'
import { DeviceType } from '/device'
import { create } from '/user/create'
import { load } from '/user/load'
import '/util/testing/expect/toLookLikeKeyset'

describe('user', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns undefined if no user exists', () => {
    const user = load()
    expect(user).toBeUndefined()
  })

  it('creates a new user', () => {
    const bob = create({
      userName: 'bob',
      deviceName: 'laptop',
      deviceType: DeviceType.laptop,
    })
    expect(bob.userName).toBe('bob')
    expect(bob).toHaveProperty('keys')
  })

  it('loads an existing user', () => {
    // Bob uses app for the first time
    const bob1 = create({
      userName: 'bob',
      deviceName: 'laptop',
      deviceType: DeviceType.laptop,
    })
    const { keys } = bob1
    expect(keys).toLookLikeKeyset()

    // Bob uses app for the second time
    const bob2 = load()!
    expect(bob2.userName).toBe('bob')
    expect(bob2).toHaveProperty('keys')
    // keyset is the same
    expect(bob2.keys).toEqual(keys)
  })

  describe('working keys', () => {
    const message = 'the crocodile lunges at dawn'

    it('provides a working keypair for signatures', () => {
      const keypair = create({
        userName: 'bob',
        deviceName: 'laptop',
        deviceType: DeviceType.laptop,
      }).keys.signature
      const { secretKey, publicKey } = keypair
      const signature = signatures.sign(message, secretKey)
      const signedMessage = { payload: message, signature, publicKey }
      expect(signatures.verify(signedMessage)).toBe(true)
    })

    it('provides a working keyset for asymmetric encryption', () => {
      const charlie = create({
        userName: 'charlie',
        deviceName: 'laptop',
        deviceType: DeviceType.laptop,
      }).keys.encryption
      const bob = asymmetric.keyPair()

      // Charlie encrypts a message for Bob
      const cipher = asymmetric.encrypt({
        secret: message,
        recipientPublicKey: bob.publicKey,
        senderSecretKey: charlie.secretKey,
      })

      // Bob decrypts the message
      const decrypted = asymmetric.decrypt({
        cipher: cipher,
        senderPublicKey: charlie.publicKey,
        recipientSecretKey: bob.secretKey,
      })
      expect(decrypted).toEqual(message)
    })

    it('provides a working keyset for symmetric encryption', () => {
      const { secretKey } = create({
        userName: 'bob',
        deviceName: 'laptop',
        deviceType: DeviceType.laptop,
      }).keys
      const cipher = symmetric.encrypt(message, secretKey)
      const decrypted = symmetric.decrypt(cipher, secretKey)
      expect(decrypted).toEqual(message)
    })
  })
})
