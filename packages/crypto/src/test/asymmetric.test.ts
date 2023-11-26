import { describe, test, expect } from 'vitest'
import { signatures, asymmetric } from '..'

const { keyPair, encryptBytes, decryptBytes, encrypt, decrypt } = asymmetric

const plaintext = 'The leopard pounces at noon'
const zalgoText = 'ẓ̴̇a̷̰̚l̶̥͑g̶̼͂o̴̅͜ ̸̻̏í̴͜s̵̜͠ ̴̦̃u̸̼̎p̵̘̔o̵̦͑ǹ̵̰ ̶̢͘u̵̇ͅș̷̏'
const poop = '💩'

describe('crypto', () => {
  describe('asymmetric encryptBytes/decryptBytes', () => {
    test('object', () => {
      const alice = keyPair()
      const bob = keyPair()
      const eve = keyPair()

      const secret = {
        foo: 'bar',
        pizza: 42,
      }

      const encrypted = encryptBytes({
        secret,
        recipientPublicKey: bob.publicKey,
        senderSecretKey: alice.secretKey,
      })
      const decrypted = decryptBytes({
        cipher: encrypted,
        senderPublicKey: alice.publicKey,
        recipientSecretKey: bob.secretKey,
      })
      expect(decrypted).toEqual(secret)

      const attemptToDecrypt = () =>
        asymmetric.decryptBytes({
          cipher: encrypted,
          senderPublicKey: alice.publicKey,
          recipientSecretKey: eve.secretKey,
        })
      expect(attemptToDecrypt).toThrow()
    })

    // If a binary cipher is stringified as part of a JSON payload, when it's parsed back out, the
    // thing we get back is no longer that msgpack can unpack, for some reason. So we need to use
    // msgpack for serialization/deserialization higher up the stack as well.
    test.fails('when payload goes through JSON.serialize', () => {
      const alice = keyPair()
      const bob = keyPair()
      const eve = keyPair()

      const secret = {
        foo: 'bar',
        pizza: 42,
      }

      const encrypted = encryptBytes({
        secret,
        recipientPublicKey: bob.publicKey,
        senderSecretKey: alice.secretKey,
      })

      const serialized = JSON.stringify(encrypted)
      const deserialized = JSON.parse(serialized)

      const decrypted = decryptBytes({
        cipher: deserialized,
        senderPublicKey: alice.publicKey,
        recipientSecretKey: bob.secretKey,
      })
      expect(decrypted).toEqual(secret)

      const attemptToDecrypt = () =>
        asymmetric.decryptBytes({
          cipher: encrypted,
          senderPublicKey: alice.publicKey,
          recipientSecretKey: eve.secretKey,
        })
      expect(attemptToDecrypt).toThrow()
    })
  })

  describe('asymmetric encrypt/decrypt', () => {
    test.each`
      label              | message
      ${'plain text'}    | ${plaintext}
      ${'empty string'}  | ${''}
      ${'emoji message'} | ${poop}
      ${'zalgo text'}    | ${zalgoText}
    `('round trip: $label', ({ message }: { label: string; message: string }) => {
      const alice = keyPair()
      const bob = keyPair()
      const eve = keyPair()

      const encrypted = encrypt({
        secret: message,
        recipientPublicKey: bob.publicKey,
        senderSecretKey: alice.secretKey,
      })
      const decrypted = decrypt({
        cipher: encrypted,
        senderPublicKey: alice.publicKey,
        recipientSecretKey: bob.secretKey,
      })
      expect(decrypted).toEqual(message)

      const attemptToDecrypt = () =>
        decrypt({
          cipher: encrypted,
          senderPublicKey: alice.publicKey,
          recipientSecretKey: eve.secretKey,
        })
      expect(attemptToDecrypt).toThrow()
    })

    test('fwiw: cannot use signature keys to encrypt', () => {
      const a = signatures.keyPair()
      const b = signatures.keyPair()
      expect(() =>
        asymmetric.encrypt({
          secret: plaintext,
          recipientPublicKey: b.publicKey,
          senderSecretKey: a.secretKey,
        })
      ).toThrow()
    })
  })

  describe('asymmetric encrypt/decrypt with ephemeral key', () => {
    test.each`
      label              | message
      ${'plain text'}    | ${plaintext}
      ${'empty string'}  | ${''}
      ${'emoji message'} | ${poop}
      ${'zalgo text'}    | ${zalgoText}
    `('round trip: $label', ({ message }: { label: string; message: string }) => {
      const bob = keyPair()
      const eve = keyPair()

      const encrypted = encrypt({
        secret: message,
        recipientPublicKey: bob.publicKey,
      })
      const decrypted = decrypt({
        cipher: encrypted,
        recipientSecretKey: bob.secretKey,
      })
      expect(decrypted).toEqual(message)

      const attemptToDecrypt = () =>
        decrypt({
          cipher: encrypted,
          recipientSecretKey: eve.secretKey,
        })
      expect(attemptToDecrypt).toThrow()
    })
  })

  describe('keyPair', () => {
    test('is deterministic if secretKey is provided', () => {
      const secretKey = 'C3U7T1J7M9gvhFHkDXeWHuAko8bdHd9w1CJKsLEUCVqp'
      const keys = keyPair(secretKey)
      expect(keys.publicKey).toMatchInlineSnapshot('"5gTFPqj34hU2g57uXRWvANQTKRdhuHhREzQqxpwjVLaz"')
    })
  })
})
