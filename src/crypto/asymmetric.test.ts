import { asymmetric } from '/crypto/asymmetric'
import { signatures } from '/crypto/signatures'

const { encrypt, decrypt, encryptWithEphemeralKey, decryptWithEphemeralKey } = asymmetric

const plaintext = 'The leopard pounces at noon'
const zalgoText = 'ẓ̴̇a̷̰̚l̶̥͑g̶̼͂o̴̅͜ ̸̻̏í̴͜s̵̜͠ ̴̦̃u̸̼̎p̵̘̔o̵̦͑ǹ̵̰ ̶̢͘u̵̇ͅș̷̏'
const poop = '💩'
const json = JSON.stringify(require('../../package.json'))

describe('crypto', () => {
  describe('asymmetric encrypt/decrypt', () => {
    const alice = asymmetric.keyPair()
    const bob = asymmetric.keyPair()
    const eve = asymmetric.keyPair()

    test.each`
      label                 | message
      ${'plain text'}       | ${plaintext}
      ${'empty string'}     | ${''}
      ${'emoji message'}    | ${poop}
      ${'stringified json'} | ${json}
      ${'zalgo text'}       | ${zalgoText}
    `('round trip: $label', ({ message }) => {
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
        encrypt({
          secret: plaintext,
          recipientPublicKey: b.publicKey,
          senderSecretKey: a.secretKey,
        })
      ).toThrow()
    })
  })

  describe('asymmetric encrypt/decrypt with ephemeral key', () => {
    const bob = asymmetric.keyPair()
    const eve = asymmetric.keyPair()

    test.each`
      label                 | message
      ${'plain text'}       | ${plaintext}
      ${'empty string'}     | ${''}
      ${'emoji message'}    | ${poop}
      ${'stringified json'} | ${json}
      ${'zalgo text'}       | ${zalgoText}
    `('round trip: $label', ({ message }) => {
      const encrypted = encryptWithEphemeralKey({
        secret: message,
        recipientPublicKey: bob.publicKey,
      })
      const decrypted = decryptWithEphemeralKey({
        cipher: encrypted,
        recipientSecretKey: bob.secretKey,
      })
      expect(decrypted).toEqual(message)

      const attemptToDecrypt = () =>
        decryptWithEphemeralKey({
          cipher: encrypted,
          recipientSecretKey: eve.secretKey,
        })
      expect(attemptToDecrypt).toThrow()
    })
  })
})
