## 🔑 Keys

Each team, each role, each user, and each device has its own **keyset**. A keyset consists of two keypairs - one for encryption and one for signatures. 

A keyset is generated from a single randomly-generated secret, following a procedure roughly based on the [Keybase docs on Per-User Keys](http://keybase.io/docs/teams/puk).

1. Randomly generate a 32-byte **secret key** `k₀`. This should be stored in the device's secure storage, and **it should never leave the original device except in encrypted form**.
2. Hash the secret key to find a seed `k₁ = hmac('SIGNATURE', k₀)`, and use [`nacl.sign.keyPair.fromSeed(k₁)`](http://github.com/dchest/tweetnacl-js/blob/master/README.md#naclsignkeypairfromseedseed) to obtain a **signature keypair**.
3. Hash the secret key to derive a new secret key `k₂ = hmac('ENCRYPTION', k₀)`, and use [`nacl.box.keyPair.fromSecretKey(k₂)`](http://github.com/dchest/tweetnacl-js/blob/master/README.md#naclboxkeypairfromsecretkeysecretkey) to obtain an  **asymmetric encryption keypair**. (The secret key of the encryption keypair can also be used for symmetric encryption.)

### `randomKey()`

Returns a cryptographically random 32-byte secret key, as a base64-encoded string.

```tsx
const seed = randomKey()
// qI7WZR+BGTAJD30JJRqRCVOLWL7iGxIHlbBmq80bjLg=
```

### `generateKeys(seed)`

Use the provided seed to generate a set of per-user or per-team keys, all in base64-encoded text.

```ts
const secretKeyset = generateKeys(seed)

// {
//   seed: 'qI7WZR+BGTAJD30JJRqRCVOLWL7iGxIHlbBmq80bjLg=',
//   encryption: {
//     publicKey: 'Yxb5B79mNvtDg9kjvDHIlFK4pu8XvXT0to9TtILijig=',
//     secretKey: 'P2rSWEUUInw/ZwkbVwV8/W6+2n2JCNeiV2S5rtyRa5I=',
//   },
//   signature: {
//     publicKey: 'xvIoa0SjV7C+tIwVLaGAXSWLH/H8KwC3BVMsQO68Er4=',
//     secretKey: 'Fv/HjgaQxrYTP+a5r0G20QppX2OD7tVFuXs...L60jBUtoYBdJYsf8fwrALcFUyxA7rwSvg==',
//   },
// }
```

### `generateKeys()`

If no seed is passed to `generateKeys()`, one will be randomly generated. 

```ts
// this...
const seed = randomKey()
const secretKeyset = generateKeys(seed)

// ...is equivalent to this:
const secretKeyset = generateKeys()
```



### `redactSecrets(secretKeyset)`

Takes a keyset that includes secret keys, and returns just the public keys.

```ts
const publicKeyset = redactSecrets(secretKeyset)

// {
//   encryption: 'Yxb5B79mNvtDg9kjvDHIlFK4pu8XvXT0to9TtILijig=',
//   signature: 'xvIoa0SjV7C+tIwVLaGAXSWLH/H8KwC3BVMsQO68Er4=',
// }
```
