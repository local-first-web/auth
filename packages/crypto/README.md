## @localfirst/crypto

These are utility wrapper functions around [libsodium.js](https://github.com/jedisct1/libsodium.js/) that simplify the process of encrypting, decrypting, signing, and hashing text in string form.

The NaCl suite was originally conceived to help developers write secure code by removing as many decision points as possible, and only including the best-in-class algorithms for a small number of primitives.

In my experience NaCl still leaves a handful of critical tasks to be performed with in userland:

- Generating nonces
- Packaging and unpackaging metadata (nonces, ephemeral public keys) alongside encrypted data
- Choosing encodings and converting strings to and from byte arrays
- Stretching passwords for symmetric encryption

The functions provided by this library encapsulate my preferred solutions to those problems. As a developer I only have to provide the inputs to these functions, so that I can encrypt, decrypt, and sign without having to think about the implementation details.

- Multi-part ciphers are packed and unpacked using `msgpack`
- All functions can accept either byte arrays or strings
- All functions output strings
- Human-facing text is encoded and decoded as `utf-8`
- Keys and ciphers are encoded and decoded as `base58`
- Short passwords are stretched using the Argon2id algorithm

### Installation

```bash
yarn add @localfirst/crypto
```

### Usage

#### Symmetric encryption

If Alice and Bob know a shared secret key, they can use it to send each other secure messages.

```ts
import { symmetric } from '@localfirst/crypto'

// Alice encrypts a message using a password that they both know
const encrypted = symmetric.encrypt('flee to the hills for all is lost', 'password123')

// Bob decrypts the message using the same password
const decrypted = symmetric.decrypt(encrypted, 'password123')
```

#### Asymmetric encryption

If Alice and Bob know the public halves of each other's encryption keys, they can send each other secure messages using the other's public key and their own secret key.

```ts
import { asymmetric } from '@localfirst/crypto'

// Alice encrypts a message using her secret key and Bob's public key
const encrypted = asymmetric.encrypt({
  secret: 'the eagle lands at dawn',
  recipientPublicKey: bob.publicKey,
  senderSecretKey: alice.secretKey,
})

// Bob decrypts the message using his secret key and Alice's public key
const decrypted = asymmetric.decrypt({
  cipher: encrypted,
  senderPublicKey: alice.publicKey,
  recipientSecretKey: bob.secretKey,
})
```

Alternatively, Alice can send a message using only Bob's public key. In this case, a one-time (ephemeral) keypair will be transparently generated, and its public key will be included as metadata.

```ts
// Alice encrypts a message using only Bob's public key
const encrypted = asymmetric.encrypt({
  secret: 'one if by land, two if by sea',
  recipientPublicKey: bob.publicKey,
})

// Bob decrypts the message just using his secret key
const decrypted = asymmetric.decrypt({
  cipher: encrypted,
  recipientSecretKey: bob.secretKey,
})
```

All keys need to have been generated using this function (or using the same underlying algorithms).

```ts
const keyPair = asymmetric.keyPair()
// { secretKey: 'kQfbC16xs1Nodahgxw527ZON...', publicKey: 'OLvouBjcjCGC3f5sQuJ29ZLx...'}
```

Note that asymmetric encryption keys cannot be used for signatures, and vice versa.

#### Cryptographic signatures

Alice signs a message using her private key:

```ts
import { signatures } from '@localfirst/crypto'

const content = 'I hereby bequeath everything I own to my devoted labradoodle, Whifflesnicks'
const signature = signatures.sign(content, alice.secretKey)
```

Since Bob knows Alice's public key, he can confirm that the signature was made using her secret key:

```ts
const isLegit = signatures.verify({ content, signature, publicKey: alice.publicKey }) // true
```

All keys need to have been generated using this function (or using the same underlying algorithms).

```ts
const keyPair = signatures.keyPair()
// { secretKey: 'YKtspDqJbOhnqCuOAKCTPnHb...', publicKey: 'ZTxpfaandCvUIo7rvoaiVJaK...'}
```

Note that signature keys cannot be used for asymmetric encryption, and vice versa.

#### Cryptographic hashes

The `hash` function takes two strings &mdash; the content to be hashed, and a seed.

```ts
import { hash } from '@localfirst/crypto'

const message = 'two if by night, three if by day'
const seed = 'TEST_HASH_PURPOSE'
const hash = crypto.hash(message, seed)
```

---

### Release notes

- version 1 used `TweetNacl.js`
- version 2+ uses `libsodium.js`.
- version 3 uses msgpack rather than JSON.stringify to encode objects
