import { asymmetric } from './asymmetric'
import * as signatures from './signatures'

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

    const knownCipher = '0UllJr2FBwolmAGHg0FUuAfpweLyUSgYT74U/RH6FeEiDw64zFxvFeLJd6LX0D/YMYxj1aNwRmy5LapQIyh1QnKLuQ==' // prettier-ignore

    test(`alice encrypts using her secret key and bob's public key`, () => {
      const cipherFromAlice = encrypt(plaintext, bob.publicKey, alice.secretKey)
      expect(cipherFromAlice).toHaveLength(24 + 68) // IV + ciphertext
      expect(cipherFromAlice).not.toEqual(knownCipher) // each encryption is different
    })

    test(`bob decrypts using his secret key and alice's public key`, () => {
      const cipherFromAlice = knownCipher
      expect(decrypt(cipherFromAlice, alice.publicKey, bob.secretKey)).toEqual(
        plaintext
      )
    })

    test(`eve can't decrypt with her secret key`, () => {
      const cipherFromAlice = knownCipher
      const attemptToDecrypt = () =>
        decrypt(cipherFromAlice, alice.publicKey, eve.secretKey)
      expect(attemptToDecrypt).toThrow()
    })

    test(`can't decrypt with the wrong public key`, () => {
      const cipherFromAlice = knownCipher
      const attemptToDecrypt = () =>
        decrypt(cipherFromAlice, eve.publicKey, bob.secretKey)
      expect(attemptToDecrypt).toThrow()
    })

    test.each`
      label                 | message
      ${'plain text'}       | ${plaintext}
      ${'empty string'}     | ${''}
      ${'emoji message'}    | ${poop}
      ${'stringified json'} | ${json}
      ${'zalgo text'}       | ${zalgoText}
    `('round trip: $label', ({ message }) => {
      const encrypted = encrypt(message, bob.publicKey, alice.secretKey)
      const decrypted = decrypt(encrypted, alice.publicKey, bob.secretKey)
      expect(decrypted).toEqual(message)

      const attemptToDecrypt = () =>
        decrypt(encrypted, alice.publicKey, eve.secretKey)
      expect(attemptToDecrypt).toThrow()
    })

    test('fwiw: cannot use signature keys to encrypt', () => {
      const a = signatures.signatures.keyPair()
      const b = signatures.signatures.keyPair()
      expect(() => encrypt(plaintext, b.publicKey, a.secretKey)).toThrow()
    })
  })
})
