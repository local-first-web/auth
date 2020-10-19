import { TwoPartyProtocol } from './TwoPartyProtocol'
import { asymmetric } from '/crypto'

describe('TwoWaySecureMessagingProtocol', () => {
  it('decrypts one message', () => {
    const aliceKeys = asymmetric.keyPair()
    const bobKeys = asymmetric.keyPair()

    const alice = new TwoPartyProtocol(aliceKeys.secretKey, bobKeys.publicKey)
    const bob = new TwoPartyProtocol(bobKeys.secretKey, aliceKeys.publicKey)

    const plainText = 'the eagle lands at midnight'
    const encrypted = alice.send(plainText)
    const decrypted = bob.receive(encrypted)
    expect(decrypted).toEqual(plainText)
  })

  it('decrypts a series of unidirectional messages', () => {
    const aliceKeys = asymmetric.keyPair()
    const bobKeys = asymmetric.keyPair()
    const alice = new TwoPartyProtocol(aliceKeys.secretKey, bobKeys.publicKey)
    const bob = new TwoPartyProtocol(bobKeys.secretKey, aliceKeys.publicKey)

    for (let i = 0; i < 10; i++) {
      const plainText = 'the eagle lands at ' + i
      const encrypted = alice.send(plainText)
      const decrypted = bob.receive(encrypted)
      expect(decrypted).toEqual(plainText)
    }
  })

  it('decrypts a series of strictly alternating messages', () => {
    const aliceKeys = asymmetric.keyPair()
    const bobKeys = asymmetric.keyPair()
    const alice = new TwoPartyProtocol(aliceKeys.secretKey, bobKeys.publicKey)
    const bob = new TwoPartyProtocol(bobKeys.secretKey, aliceKeys.publicKey)

    for (let i = 0; i < 10; i++) {
      const alicePlainText = 'alice ' + i
      const aliceEncrypted = alice.send(alicePlainText)
      const aliceDecrypted = bob.receive(aliceEncrypted)
      expect(aliceDecrypted).toEqual(alicePlainText)

      const bobPlainText = 'bob ' + i
      const bobEncrypted = bob.send(bobPlainText)
      const bobDecrypted = alice.receive(bobEncrypted)
      expect(bobDecrypted).toEqual(bobPlainText)
    }
  })

  it('decrypts a series of concurrent messages in lockstep', () => {
    const aliceKeys = asymmetric.keyPair()
    const bobKeys = asymmetric.keyPair()
    const alice = new TwoPartyProtocol(aliceKeys.secretKey, bobKeys.publicKey)
    const bob = new TwoPartyProtocol(bobKeys.secretKey, aliceKeys.publicKey)

    for (let i = 0; i < 10; i++) {
      const alicePlainText = 'alice ' + i
      const aliceEncrypted = alice.send(alicePlainText)

      const bobPlainText = 'bob ' + i
      const bobEncrypted = bob.send(bobPlainText)

      const aliceDecrypted = bob.receive(aliceEncrypted)
      expect(aliceDecrypted).toEqual(alicePlainText)

      const bobDecrypted = alice.receive(bobEncrypted)
      expect(bobDecrypted).toEqual(bobPlainText)
    }
  })

  it('can only decrypt a message once', () => {
    const aliceKeys = asymmetric.keyPair()
    const bobKeys = asymmetric.keyPair()

    const alice = new TwoPartyProtocol(aliceKeys.secretKey, bobKeys.publicKey)
    const bob = new TwoPartyProtocol(bobKeys.secretKey, aliceKeys.publicKey)

    const plainText = 'the eagle lands at midnight'
    const encrypted = alice.send(plainText)

    // we can decrypt it the first time, but then we throw away the decryption key
    const decrypted = bob.receive(encrypted)
    expect(decrypted).toEqual(plainText)

    // so if we try to decrypt the same message a second time, it fails
    const tryToDecryptAgain = () => bob.receive(encrypted)
    expect(tryToDecryptAgain).toThrow('A cipher can only be decrypted once')
  })

  it(`requires messages to be processed in order`, () => {
    const aliceKeys = asymmetric.keyPair()
    const bobKeys = asymmetric.keyPair()

    const alice = new TwoPartyProtocol(aliceKeys.secretKey, bobKeys.publicKey)
    const bob = new TwoPartyProtocol(bobKeys.secretKey, aliceKeys.publicKey)

    const encrypted1 = alice.send('alice 1')
    const encrypted2 = alice.send('alice 2')
    const encrypted3 = alice.send('alice 3')

    const tryToProcessOutOfOrder = () => {
      bob.receive(encrypted1)
      bob.receive(encrypted3)
      bob.receive(encrypted2)
    }

    expect(tryToProcessOutOfOrder).toThrow()
  })
})
