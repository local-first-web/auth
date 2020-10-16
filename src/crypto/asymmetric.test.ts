import { asymmetric } from '/crypto/asymmetric'
import { signatures } from '/crypto/signatures'

const plaintext = 'The leopard pounces at noon'
const zalgoText = 'ẓ̴̇a̷̰̚l̶̥͑g̶̼͂o̴̅͜ ̸̻̏í̴͜s̵̜͠ ̴̦̃u̸̼̎p̵̘̔o̵̦͑ǹ̵̰ ̶̢͘u̵̇ͅș̷̏'
const poop = '💩'
const json = JSON.stringify(require('../../package.json'))

describe('crypto', () => {
  describe('asymmetric encrypt/decrypt', () => {
    const { encrypt, decrypt } = asymmetric

    const alice = {
      publicKey: 'uUcxiVUXq8LnLVS5yjmfIdd2ZAuWIWfM4IVeuXqSyUY=',
      secretKey: 'wOyhsgjAdHPo8oPew31wyMJo+1ckA0zQoebgtN8hK9U=',
    }

    const bob = {
      publicKey: 'QwqgJTVqB1hxdMxgY42lQT9gss1SUrUtfh45wZzc33g=',
      secretKey: 'paGP2tYzpV8kYzeD5dJtcmB1o16N1uh9eBadkvHktnY=',
    }

    const eve = {
      publicKey: 'jVj8N4+zpxIoVLlpu0KA7Ai8OR8I4QhnS64WMhQk4R0=',
      secretKey: 'qiSxzj2NgUt5YUj6PccfiEjYQI8wIlPgWqs9HeaBEbs=',
    }

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
})
