import { randomKey, signatures, asymmetric } from '..'
import { Base58, SignedMessage } from '../types'

const { keyPair, sign, verify } = signatures

describe('crypto', () => {
  describe('signatures', () => {
    const payload = 'one if by day, two if by night'

    test('alice signs with her secret key', () => {
      const alice = keyPair('alice')
      const signature = sign(payload, alice.secretKey)
      expect(signature).toMatchInlineSnapshot(
        `"2NkJHbpTYjZqrdnRKqzTtVKNrGcsDSFh2mdx7GdTeoMGXfwkMDXzKywASZkgoZ6Q7Try2BPrptnLjdstxmzRnu1E"`,
      )
    })

    test(`bob verifies using alice's public key`, () => {
      const alice = keyPair('alice')
      const signature = sign(payload, alice.secretKey)
      const { publicKey } = alice
      const isLegit = verify({ payload, signature, publicKey })
      expect(isLegit).toBe(true)
    })

    test(`round trip with bytes payload`, () => {
      const alice = keyPair('alice')
      const payload = randomKey()
      const { secretKey, publicKey } = alice
      const signature = sign(payload, secretKey)
      const isLegit = verify({ payload, signature, publicKey })
      expect(isLegit).toBe(true)
    })

    test(`round trip with JSON payload`, () => {
      const payload = {
        type: 0,
        payload: { team: 'Spies Я Us' },
        user: 'alice',
        client: { name: 'test', version: '0' },
        timestamp: 1588335904711,
        index: 0,
        prev: undefined,
      }
      const alice = keyPair('alice')
      const { secretKey, publicKey } = alice
      const signature = sign(payload, secretKey)
      const isLegit = verify({ payload, signature, publicKey })
      expect(isLegit).toBe(true)
    })

    test(`Eve tampers with the message, but Bob is not fooled`, () => {
      // Alice signs a message
      const alice = keyPair('alice')
      const signedMessage: SignedMessage = {
        payload,
        signature: sign(payload, alice.secretKey),
        publicKey: alice.publicKey,
      }

      // Eve tampers with the contents of the message
      const tamperedContent = payload //
        .replace('one', 'forty-two')
        .replace('two', 'seventy-twelve')
      const tamperedMessage = {
        ...signedMessage,
        payload: tamperedContent,
      }

      // Bob is not fooled
      const isLegit = verify(tamperedMessage)
      expect(isLegit).toBe(false)
    })

    test(`fails verification if signature is wrong`, () => {
      const alice = keyPair('alice')
      const signedMessage: SignedMessage = {
        payload,
        signature: sign(payload, alice.secretKey),
        publicKey: alice.publicKey,
      }

      const badSignature =
        '5VanBWz6kBnV2wfJZaPgv81Mj7QtAsPmq3QZgc3zZqbYZEzEdZQ9r24BGZpN6mt6djyr7W2v1eKYnnG3KSHtCD67' as Base58
      const badMessage = {
        ...signedMessage,
        signature: badSignature,
      }
      const isLegit = verify(badMessage)
      expect(isLegit).toBe(false)
    })

    test(`fails verification if public key is wrong`, () => {
      const alice = keyPair('alice')
      const signedMessage: SignedMessage = {
        payload,
        signature: sign(payload, alice.secretKey),
        publicKey: alice.publicKey,
      }
      const badKey = 'AAAAAnDzHhf26V8KcmQdxquK4fWUNDRy3MA6Sqf5hSma' as Base58
      const badMessage = {
        ...signedMessage,
        publicKey: badKey,
      }
      const isLegit = verify(badMessage)
      expect(isLegit).toBe(false)
    })

    test('fwiw: cannot use encryption keys to sign', () => {
      const keysForAnotherPurpose = asymmetric.keyPair()
      const tryToSignWithEncryptionKeys = () =>
        signatures.sign(payload, keysForAnotherPurpose.secretKey)
      expect(tryToSignWithEncryptionKeys).toThrow()
    })

    test('keypair generated from seed is deterministic', () => {
      // Alice signs a message
      const seed = 'passw0rd'
      const keys = keyPair(seed)
      expect(keys).toMatchInlineSnapshot(`
        {
          "publicKey": "ATRhGtszfTKdTYxDLf6PMtvF16xrCXuKNKqP9KQSAZhr",
          "secretKey": "3ddvXNtSVXGjnLSu4WVCxFvdtqHnL1PQuNxPCMJLMMBrcGGhZ9x5A8xGCCWTh7ADEndy3DWzLCLH9peqE5kjcjn8",
        }
      `)
    })
  })
})
