## 🔑 Keys

Per-user keys and per-team keys are generated from a single secret, following a procedure roughly based on the [Keybase docs on Per-User Keys](http://keybase.io/docs/teams/puk).

1. Randomly generate a 32-byte **secret key** `k₀`. This should be stored in the device's secure storage, and **it should never leave the original device except in encrypted form**.
2. Hash the secret key to find a seed `k₁ = hmac('SIGNATURE', k₀)`, and use [`nacl.sign.keyPair.fromSeed(k₁)`](http://github.com/dchest/tweetnacl-js/blob/master/README.md#naclsignkeypairfromseedseed) to obtain a **signature keypair**.
3. Hash the secret key to derive a new secret key `k₂ = hmac('ENCRYPTION_ASYMMETRIC', k₀)`, and use [`nacl.box.keyPair.fromSecretKey(k₂)`](http://github.com/dchest/tweetnacl-js/blob/master/README.md#naclboxkeypairfromsecretkeysecretkey) to obtain an **encryption keypair**.
4. Hash the secret key to derive a new secret key `k₃ = hmac('ENCRYPTION_SYMMETRIC', k₀)`. This will be the symmetric encryption key.

### `randomKey`

Returns a cryptographically random 32-byte secret key, as a base64-encoded string.

```ts
const secretKey = randomKey()
// qI7WZR+BGTAJD30JJRqRCVOLWL7iGxIHlbBmq80bjLg=
```

### `deriveKeys`

Generate a set of per-user or per-team keys, all in base64-encoded text.

```ts
const secretKeyset = deriveKeys(secretKey)
// returns
{
  signature: {
    publicKey: 'xvIoa0SjV7C+tIwVLaGAXSWLH/H8KwC3BVMsQO68Er4=',
    secretKey: 'Fv/HjgaQxrYTP+a5r0G20QppX2OD7tVFuXs...L60jBUtoYBdJYsf8fwrALcFUyxA7rwSvg=='
  },
  asymmetric: {
    publicKey: 'Yxb5B79mNvtDg9kjvDHIlFK4pu8XvXT0to9TtILijig=',
    secretKey: 'P2rSWEUUInw/ZwkbVwV8/W6+2n2JCNeiV2S5rtyRa5I='
  },
  symmetric: { key: 'DDJy5aFAzGuSkwcA2PuPMqcO5Nc1VJDincnayGiaLDQ=' }
}
```

### `redactSecrets`

Takes a keyset that includes secret keys, and returns just the public keys.

```ts
const publicKeyset = redactSecrets(secretKeyset)
// returns
{
  encryption: 'Yxb5B79mNvtDg9kjvDHIlFK4pu8XvXT0to9TtILijig=',
  signature: 'xvIoa0SjV7C+tIwVLaGAXSWLH/H8KwC3BVMsQO68Er4=',
}
```
