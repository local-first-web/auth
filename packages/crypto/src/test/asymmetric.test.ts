import { signatures, asymmetric } from '..'
const { keyPair, encrypt, decrypt } = asymmetric

const plaintext = 'The leopard pounces at noon'
const zalgoText = 'ẓ̴̇a̷̰̚l̶̥͑g̶̼͂o̴̅͜ ̸̻̏í̴͜s̵̜͠ ̴̦̃u̸̼̎p̵̘̔o̵̦͑ǹ̵̰ ̶̢͘u̵̇ͅș̷̏'
const poop = '💩'

describe('crypto', () => {
  describe('asymmetric encrypt/decrypt', () => {
    test.each`
      label              | message
      ${'plain text'}    | ${plaintext}
      ${'empty string'}  | ${''}
      ${'emoji message'} | ${poop}
      ${'zalgo text'}    | ${zalgoText}
    `('round trip: $label', ({ message }) => {
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
    `('round trip: $label', ({ message }) => {
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
      expect(keys.publicKey).toMatchInlineSnapshot(`"5gTFPqj34hU2g57uXRWvANQTKRdhuHhREzQqxpwjVLaz"`)
    })
  })
})
