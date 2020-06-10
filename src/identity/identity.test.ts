import { claim, challenge, prove, verify } from '/identity'
import { KeyType, TEAM_SCOPE } from '/keyset'
import * as keyset from '/keyset'
import { bob, eve } from '/util/testing'

const { MEMBER } = KeyType

describe('identity', () => {
  it('accepts valid proof of identity', () => {
    const bobSecretKeys = bob.keys
    const bobPublicKeys = keyset.redact(bob.keys)

    // 👨‍🦲 Bob shows up and says he's Bob
    const bobsClaim = claim({ type: MEMBER, name: 'bob' })

    // 👩🏾 Alice asks maybe-Bob to prove it by sending him a document to sign
    const alicesChallenge = challenge(bobsClaim)

    // 👨‍🦲 Bob submits proof
    const bobsProof = prove(alicesChallenge, bobSecretKeys)

    // 👩🏾 Alice checks his proof
    const validation = verify(alicesChallenge, bobsProof, bobPublicKeys)

    // ✅ Bob's proof checks out
    expect(validation.isValid).toBe(true)
  })

  it('rejects proof of identity with the wrong signature', () => {
    const eveSecretKeys = eve.keys
    const bobPublicKeys = keyset.redact(bob.keys)

    // 🦹‍♀️ Eve shows up and says she's Bob
    const evesClaimToBeBob = claim({ type: MEMBER, name: 'bob' })

    // 👩🏾 Alice asks maybe-Bob to prove it by sending him a document to sign
    const alicesChallenge = challenge(evesClaimToBeBob)

    // 🦹‍♀️ Eve tries to submit proof
    const evesProof = prove(alicesChallenge, eveSecretKeys)

    // 👩🏾 Alice checks Eve's proof
    const validation = verify(alicesChallenge, evesProof, bobPublicKeys)

    // ❌ Eve's proof fails because she doesn't have Bob's secret signature key
    expect(validation.isValid).toBe(false)
  })

  it('rejects reused proof of identity', () => {
    const bobSecretKeys = bob.keys
    const bobPublicKeys = keyset.redact(bob.keys)

    // 👨‍🦲 Bob shows up and says he's Bob
    const bobsClaim = claim({ type: MEMBER, name: 'bob' })

    // 👩🏾 Alice asks maybe-Bob to prove it by sending him a document to sign
    const alicesChallengeToBob = challenge(bobsClaim)

    // 👨‍🦲 Bob submits proof
    const bobsProof = prove(alicesChallengeToBob, bobSecretKeys)

    // 👩🏾 Alice checks his proof
    const validationOfBobsProof = verify(alicesChallengeToBob, bobsProof, bobPublicKeys)

    // ✅ Bob's proof checks out
    expect(validationOfBobsProof.isValid).toBe(true)

    // 👀 BUT! Eve intercepted Bob's proof, so she tries to re-use it

    // 🦹‍♀️ Eve shows up and says she's Bob
    const evesClaimToBeBob = claim({ type: MEMBER, name: 'bob' })

    // 👩🏾 Alice checks asks maybe-Bob to prove it by sending him a document to sign
    const alicesChallengeToEve = challenge(evesClaimToBeBob)

    // 🦹‍♀️ Eve submits the proof she intercepted from Bob
    const evesProof = bobsProof

    // 👩🏾 Alice checks Eve's proof
    const validationOfEvesProof = verify(alicesChallengeToEve, evesProof, bobPublicKeys)

    // ❌ FOILED AGAIN!! Eve's proof fails because the challenge she was given is different
    expect(validationOfEvesProof.isValid).toBe(false)
  })

  it('validates team membership', () => {
    const teamKeys = keyset.create(TEAM_SCOPE)

    // 👨‍🦲 Bob shows up and says he's a member of the team
    const bobsClaim = claim(TEAM_SCOPE)

    // 👩🏾 Alice asks maybe-Bob to prove it by sending him a document to sign
    const alicesChallenge = challenge(bobsClaim)

    // 👨‍🦲 Bob submits proof
    const bobsProof = prove(alicesChallenge, teamKeys)

    // 👩🏾 Alice checks his proof
    const validation = verify(alicesChallenge, bobsProof, keyset.redact(teamKeys))

    // ✅ Bob's proof checks out
    expect(validation.isValid).toBe(true)
  })
})
