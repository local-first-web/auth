import { asymmetric } from './asymmetric'
import { signatures, SignedMessage } from './signatures'

import nacl from 'tweetnacl'

const plaintext = 'The leopard pounces at noon'

describe('crypto', () => {
  describe('signatures', () => {
    const { sign, verify } = signatures

    // prettier-ignore
    const alice = {
      publicKey: 'OH8olQvUFfxqjd+A4FkPQZq0mSb9GGKIOfuCFLDd0B0=',
      secretKey: 'TVTqqajwDkAMlztAJEkgcnEd1KzWheaDQE6sxPGlUlY4fyiVC9QV/GqN34DgWQ9BmrSZJv0YYog5+4IUsN3QHQ==',
    }

    // prettier-ignore
    const signedMessage: SignedMessage = {
      payload: 'one if by day, two if by night',
      signature: 'Qd9f/Xgk9QFG9nVNb/QkHqKTNF0JQCEy848m4w8UmxSRwnuomBZz6Bi8wDopz//iKwHq3ipMvA2AGAw8Oo19Dw==',
      publicKey: alice.publicKey,
    }

    test('alice signs with her secret key', () => {
      const { payload: content, signature: knownSignature } = signedMessage
      const signature = sign(content, alice.secretKey)
      expect(signature).toEqual(knownSignature)
    })

    test(`bob verifies using alice's public key`, () => {
      const isLegit = verify(signedMessage)
      expect(isLegit).toBe(true)
    })

    test(`round trip with bytes payload`, () => {
      const payload = nacl.randomBytes(32)
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
        device: {
          id: 'seccQeheyHxM4gBmetpJOPrugu+iqS25M+fn4pp6BZ4=',
          name: 'windows laptop',
          type: 1,
        },
        client: { name: 'test', version: '0' },
        timestamp: 1588335904711,
        index: 0,
        prev: undefined,
      }
      const { secretKey, publicKey } = alice
      const signature = sign(payload, secretKey)
      const isLegit = verify({ payload, signature, publicKey })
      expect(isLegit).toBe(true)
    })

    test(`JSON normalization`, () => {
      const payload = { a: 1, b: 2, c: 3 }
      const scrambled = { b: 2, a: 1, c: 3 }

      const { secretKey, publicKey } = alice
      const signature = sign(scrambled, secretKey)
      const isLegit = verify({ payload, signature, publicKey })
      expect(isLegit).toBe(true)
    })

    test(`Eve tampers with the message, but Bob is not fooled`, () => {
      // Eve
      const tamperedContent = (signedMessage.payload as string)
        .replace('one', 'forty-two')
        .replace('two', 'seventy-twelve')
      const tamperedMessage = {
        ...signedMessage,
        payload: tamperedContent,
      }

      // Bob
      const isLegit = verify(tamperedMessage)
      expect(isLegit).toBe(false)
    })

    test(`fails verification if signature is wrong`, () => {
      const badSignature =
        'Iamabadbadsignature+JlhN8veVIBQ/SO4d59oLiCkEG57ZubXLsMaaNzk91ujZjXkS9doP2vCAFimKvKdgjy=='
      const badMessage = {
        ...signedMessage,
        signature: badSignature,
      }
      const isLegit = verify(badMessage)
      expect(isLegit).toBe(false)
    })

    test(`fails verification if public key is wrong`, () => {
      const badKey = 'NachoKeySb9GGKIOfuCFLDd0B0OH8olQvUFfxqjd+A4='
      const badMessage = {
        ...signedMessage,
        publicKey: badKey,
      }
      const isLegit = verify(badMessage)
      expect(isLegit).toBe(false)
    })

    test('fwiw: cannot use encryption keys to sign', () => {
      const a = asymmetric.keyPair()
      expect(() => sign(plaintext, a.secretKey)).toThrow()
    })
  })
})
