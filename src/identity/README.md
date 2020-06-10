# Identity

Authentication is tricky in a distributed, peer-to-peer world. Someone shows up, saying they're Bob.
Without a trusted third party in the form of a centralized server to vouch that this is indeed Bob,
how can Alice be sure that she's not talking to an impostor?

The answer is a cryptographic **signature challenge**. It kind of works like this:

<img src='../../docs/img/sigchallenge.png' width='400' />

Specifically, here's how our signature challenge protocol works:

- **Claim**: Bob claims that he is the team member with the username `bob` by means of this message:

  ```js
  {
    type: 'CLAIM_IDENTITY',
    payload: {
      type: 'MEMBER',
      name: 'bob'
    }
  }
  ```

- **Challenge**: Alice gives Bob a document to sign. The document contains Bob's original claim,
  plus a timestamp and a random nonce. These last two ensure that each challenge is unique, so that
  if Eve intercepts Bob's signed proof of identity, she can't reuse it to claim to be Bob.

  ```js
  {
    type: 'CHALLENGE_IDENTITY',
    payload: {
      type: 'MEMBER',
      name: 'bob',
      nonce: 'ueQhdcS9Ky3nNzWLnAcg25PAW9KqMXbOhbzfUM46G8lFpV8A',
      timestamp: 1591785804793
    }
  }
  ```

- **Proof**: Using his signature secret key, Bob signs the challenge document, and returns it to
  Alice along with the signature.

  ```js
  {
    type: 'PROVE_IDENTITY',
    payload: {
      type: 'MEMBER',
      name: 'bob',
      nonce: 'ueQhdcS9Ky3nNzWLnAcg25PAW9KqMXbOhbzfUM46G8lFpV8A',
      timestamp: 1591785804793,
      signature: 'UmCLHmSRT+4qUfl1W1t/hXsPaSdPoVXuANWdcDz52bJzO...UEdN9bZ=='
    }
  }
  ```

- **Verification**: Alice checks the signature against Bob's public signature key, which is recorded
  in the team's signature chain.

Here's an end-to-end example from the test suite, showing how Eve cannot reuse an intercepted proof.

```js
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
```
