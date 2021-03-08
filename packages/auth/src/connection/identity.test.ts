import { challenge, prove, verify } from '/connection/identity'
import { ADMIN_SCOPE, KeyScope, KeyType, TEAM_SCOPE } from '/keyset'
import * as keyset from '/keyset'
import { setup } from '/util/testing'

import '/util/testing/expect/toBeValid'

const { bob, eve } = setup('alice', 'bob', 'eve')

const { MEMBER } = KeyType

describe('identity', () => {
  it('accepts valid proof of identity', () => {
    const bobSecretKeys = bob.user.keys
    const bobPublicKeys = keyset.redactKeys(bob.user.keys)

    // 👨🏻‍🦲 Bob shows up and says he's Bob
    const bobsClaim: KeyScope = { type: MEMBER, name: 'bob' }

    // 👩🏾 Alice asks maybe-Bob to prove it by sending him a document to sign
    const alicesChallenge = challenge(bobsClaim)

    // 👨🏻‍🦲 Bob submits proof
    const bobsProof = prove(alicesChallenge, bobSecretKeys)

    // 👩🏾 Alice checks his proof
    const validation = verify(alicesChallenge, bobsProof, bobPublicKeys)

    // ✅ Bob's proof checks out
    expect(validation).toBeValid()
  })

  it('rejects proof of identity with the wrong signature', () => {
    const eveSecretKeys = eve.user.keys
    const bobPublicKeys = keyset.redactKeys(bob.user.keys)

    // 🦹‍♀️ Eve shows up and says she's Bob
    const evesClaimToBeBob: KeyScope = { type: MEMBER, name: 'bob' }

    // 👩🏾 Alice asks maybe-Bob to prove it by sending him a document to sign
    const alicesChallenge = challenge(evesClaimToBeBob)

    // 🦹‍♀️ Eve tries to submit proof
    const evesProof = prove(alicesChallenge, eveSecretKeys)

    // 👩🏾 Alice checks Eve's proof
    const validation = verify(alicesChallenge, evesProof, bobPublicKeys)

    // ❌ Eve's proof fails because she doesn't have Bob's secret signature key
    expect(validation).not.toBeValid()
  })

  it('rejects reused proof of identity', () => {
    const bobSecretKeys = bob.user.keys
    const bobPublicKeys = keyset.redactKeys(bob.user.keys)

    // 👨🏻‍🦲 Bob shows up and says he's Bob
    const bobsClaim: KeyScope = { type: MEMBER, name: 'bob' }

    // 👩🏾 Alice asks maybe-Bob to prove it by sending him a document to sign
    const alicesChallengeToBob = challenge(bobsClaim)

    // 👨🏻‍🦲 Bob submits proof
    const bobsProof = prove(alicesChallengeToBob, bobSecretKeys)

    // 👩🏾 Alice checks his proof
    const validationOfBobsProof = verify(alicesChallengeToBob, bobsProof, bobPublicKeys)

    // ✅ Bob's proof checks out
    expect(validationOfBobsProof).toBeValid()

    // 👀 BUT! Eve intercepted Bob's proof, so she tries to re-use it

    // 🦹‍♀️ Eve shows up and says she's Bob
    const evesClaimToBeBob: KeyScope = { type: MEMBER, name: 'bob' }

    // 👩🏾 Alice checks asks maybe-Bob to prove it by sending him a document to sign
    const alicesChallengeToEve = challenge(evesClaimToBeBob)

    // 🦹‍♀️ Eve submits the proof she intercepted from Bob
    const evesProof = bobsProof

    // 👩🏾 Alice checks Eve's proof
    const validationOfEvesProof = verify(alicesChallengeToEve, evesProof, bobPublicKeys)

    // ❌ FOILED AGAIN!! Eve's proof fails because the challenge she was given is different
    expect(validationOfEvesProof).not.toBeValid()
  })

  it('validates role membership', () => {
    const adminKeys = keyset.create(ADMIN_SCOPE)

    // 👨🏻‍🦲 Bob shows up and says he's an admin
    const bobsClaim = ADMIN_SCOPE

    // 👩🏾 Alice asks maybe-Bob to prove it by sending him a document to sign
    const alicesChallenge = challenge(bobsClaim)

    // 👨🏻‍🦲 Bob submits proof
    const bobsProof = prove(alicesChallenge, adminKeys)

    // 👩🏾 Alice checks his proof
    const validation = verify(alicesChallenge, bobsProof, keyset.redactKeys(adminKeys))

    // ✅ Bob's proof checks out
    expect(validation).toBeValid()
  })

  it('validates team membership', () => {
    const teamKeys = keyset.create(TEAM_SCOPE)

    // 👨🏻‍🦲 Bob shows up and says he's a member of the team
    const bobsClaim = TEAM_SCOPE

    // 👩🏾 Alice asks maybe-Bob to prove it by sending him a document to sign
    const alicesChallenge = challenge(bobsClaim)

    // 👨🏻‍🦲 Bob submits proof
    const bobsProof = prove(alicesChallenge, teamKeys)

    // 👩🏾 Alice checks his proof
    const validation = verify(alicesChallenge, bobsProof, keyset.redactKeys(teamKeys))

    // ✅ Bob's proof checks out
    expect(validation).toBeValid()
  })
})
