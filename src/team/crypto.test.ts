import { ADMIN } from '/role'
import { setup } from '/util/testing'

describe('Team', () => {
  describe('crypto', () => {
    describe('encryption', () => {
      it('encrypts content for the team', () => {
        const { alice, bob } = setup(['alice', 'bob'])

        // 👩🏾 Alice encrypts a message for the whole team
        const message = 'I need someone to take care of that thing'
        const encrypted = alice.team.encrypt(message)

        // 👨🏻‍🦲 ✅ Bob decrypts the message
        const decrypted = bob.team.decrypt(encrypted)
        expect(decrypted).toEqual(message)
      })

      it('encrypts content for a role', () => {
        const { alice, bob, charlie } = setup([
          'alice',
          { user: 'bob', admin: true },
          { user: 'charlie', admin: false },
        ])

        // 👩🏾 Alice encrypts a message for the admin users
        const message = 'You know, the situation, I need that taken care of'
        const encrypted = alice.team.encrypt(message, ADMIN)

        // 👨🏻‍🦲 ✅ Bob can decrypt the message because he is an admin
        const decrypted = bob.team.decrypt(encrypted)
        expect(decrypted).toEqual(message)

        // 👳🏽‍♂️ ❌ Charlie can't decrypt the message because he is not an admin
        expect(() => charlie.team.decrypt(encrypted)).toThrow()
      })
    })

    describe('signatures', () => {
      it('validates a signed message', () => {
        const { alice, bob } = setup(['alice', { user: 'bob', admin: true }])

        // 👨🏻‍🦲 Bob signs a message
        const message = 'That thing, I took care of it, boss'
        const signed = bob.team.sign(message)

        // 👩🏾 ✅ Alice verifies that it was signed by Bob
        expect(signed.author.name).toBe('bob')
        expect(alice.team.verify(signed)).toBe(true)
      })
    })
  })
})
