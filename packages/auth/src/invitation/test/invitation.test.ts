import { createKeyset } from '@localfirst/crdx'
import { describe, expect, test } from 'vitest'
import { create, generateProof, randomSeed, validate } from 'invitation/index.js'

describe('invitations', () => {
  test('create invitation', () => {
    const seed = randomSeed()
    const invitation = create({ kind: 'MEMBER', seed })
    // Looks like an invitation
    expect(invitation).toHaveProperty('id')
    expect(invitation.id).toHaveLength(15)
    expect(invitation).toHaveProperty('publicKey')
  })

  test('validate member invitation', () => {
    // 👩🏾 Alice generates a secret key and sends it to 👨🏻‍🦲 Bob via a trusted side channel.
    const seed = 'passw0rd'

    // 👩🏾 Alice generates an invitation with this key. Normally the invitation would be stored on the
    // team's signature chain; here we're just keeping it around in a variable.
    const invitation = create({ kind: 'MEMBER', seed })

    // 👨🏻‍🦲 Bob accepts invitation and obtains a credential proving that he was invited. His proof
    // commits to the keys he'll be admitted under.
    const bobsKeys = createKeyset({ type: 'USER', name: 'bob' })
    const proofOfInvitation = generateProof(seed, bobsKeys)

    // 👨🏻‍🦲 Bob shows up to join the team & sees 👳🏽‍♂️ Charlie. Bob shows Charlie his proof of invitation, and
    // 👳🏽‍♂️ Charlie checks it against the invitation that Alice posted on the signature chain.
    const validationResult = validate(proofOfInvitation, invitation)

    // ✅
    expect(validationResult.isValid).toBe(true)
  })

  test('you have to have the secret key to accept an invitation', () => {
    // 👩🏾 Alice uses a secret key to create an invitation; she sends it to Bob via a trusted side channel
    const seed = 'passw0rd'

    // And uses it to create an invitation for him
    const invitation = create({ kind: 'MEMBER', seed })

    // 🦹‍♀️ Eve tries to accept the invitation in Bob's place, but she doesn't have the correct invitation key
    const evesKeys = createKeyset({ type: 'USER', name: 'eve' })
    const proofOfInvitation = generateProof('horsebatterycorrectstaple', evesKeys)

    // ❌ Nice try, Eve!!!
    const validationResult = validate(proofOfInvitation, invitation)
    expect(validationResult.isValid).toBe(false)
  })

  test('the same proof is rejected against a different invitation', () => {
    const bobsKeys = createKeyset({ type: 'USER', name: 'bob' })
    const proofOfInvitation = generateProof('passw0rd', bobsKeys)

    // 👨🏻‍🦲 Bob's proof checks out against the invitation it was made for
    const invitation = create({ kind: 'MEMBER', seed: 'passw0rd' })
    expect(validate(proofOfInvitation, invitation).isValid).toBe(true)

    // ❌ ...and not against any other invitation. Validation is memoized, so this only holds if the
    // invitation is part of what the cache is keyed on.
    const someoneElsesInvitation = create({ kind: 'MEMBER', seed: 'horsebatterycorrectstaple' })
    expect(validate(proofOfInvitation, someoneElsesInvitation).isValid).toBe(false)

    // ✅ The original answer is unchanged
    expect(validate(proofOfInvitation, invitation).isValid).toBe(true)
  })

  test('a tampered proof is rejected even if it reuses a valid signature', () => {
    const bobsKeys = createKeyset({ type: 'USER', name: 'bob' })
    const invitation = create({ kind: 'MEMBER', seed: 'passw0rd' })
    const proofOfInvitation = generateProof('passw0rd', bobsKeys)
    expect(validate(proofOfInvitation, invitation).isValid).toBe(true)

    // ❌ The signature covers the invitee and the hash of their keys, so a proof that keeps the
    // signature but changes what it names is a forgery — including for the cache
    const tamperedProof = { ...proofOfInvitation, invitee: 'eve' }
    expect(validate(tamperedProof, invitation).isValid).toBe(false)
  })
})
