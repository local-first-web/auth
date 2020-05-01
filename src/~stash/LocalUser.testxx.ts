// import { LocalUser } from './LocalUser'
// import { signatures, asymmetric, symmetric } from '../lib'

// describe('LocalUser', () => {
//   const message = 'the crocodiles lunges at dawn'

//   beforeEach(() => {
//     localStorage.clear()
//   })

//   it('should instantiate a user', () => {
//     const herb = new LocalUser({ name: 'herb' })
//     expect(herb).toHaveProperty('keys')
//   })

//   it('should retrieve the keyset for a known user', () => {
//     // herb uses app for the first time
//     const herb1 = new LocalUser({ name: 'herb' })
//     const { keys } = herb1
//     expect(keys).toHaveProperty('signature')
//     expect(keys).toHaveProperty('asymmetric')
//     expect(keys).toHaveProperty('symmetric')

//     // herb uses app for the second time
//     const herb2 = new LocalUser({ name: 'herb' })

//     // keyset is the same
//     expect(herb2.keys).toEqual(keys)
//   })

//   it('should keep keysets separate for different users', () => {
//     // herb uses app
//     const herb = new LocalUser({ name: 'herb' })

//     // alice uses app on the same device (?)
//     const alice = new LocalUser({ name: 'alice' })

//     // keyset is different
//     expect(alice.keys).not.toEqual(herb.keys)
//   })

//   it('should provide a working keypair for signatures', () => {
//     const keypair = new LocalUser({ name: 'bob' }).keys.signature
//     const { secretKey, publicKey } = keypair
//     const signature = signatures.sign(message, secretKey)
//     const signedMessage = { content: message, signature, publicKey }
//     expect(signatures.verify(signedMessage)).toBe(true)
//   })

//   it('should provide a working keyset for asymmetric encryption', () => {
//     const a = new LocalUser({ name: 'charlie' }).keys.asymmetric
//     const b = asymmetric.keyPair()
//     const cipher = asymmetric.encrypt(message, b.publicKey, a.secretKey)
//     const decrypted = asymmetric.decrypt(cipher, a.publicKey, b.secretKey)
//     expect(decrypted).toEqual(message)
//   })

//   it('should provide a working key for symmetric encryption', () => {
//     const { keys: keyset } = new LocalUser({ name: 'eve' })
//     const key = keyset.symmetric
//     const cipher = symmetric.encrypt(message, key)
//     const decrypted = symmetric.decrypt(cipher, key)
//     expect(decrypted).toEqual(message)
//   })
// })
