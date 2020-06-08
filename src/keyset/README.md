## 🔑🗝 Keyset

Each team, each role, each user, and each device has its own **keyset**. A keyset consists of two keypairs - one for encryption and one for signatures. 

> **Note:** The encryption keypair can be used for asymmetric encryption; its private key can also be used for symmetric encryption. 

### `create(scope)`

A keyset is generated from a single randomly-generated secret, following a procedure roughly based on the [Keybase docs on Per-User Keys](http://keybase.io/docs/teams/puk).

Each keyset is associated with a **scope**, which could be:

- an entire **team**: `{ type: TEAM }`
- a specific **role**: `{ type: ROLE, name: 'admin' }`
- a specific **member**: `{ type: MEMBER, name: 'alice' }`
- a specific **device**: `{ type: DEVICE, name: 'alice laptop' }`
- **ephemeral** (a throwaway or single-use keyset): `{ type: EPHEMERAL }`

```ts
const adminKeys = keyset.create({type: ROLE, name: 'admin'})

{
	type: 'ROLE', 
  name: 'admin',
  generation: 0,
  signature: {
    publicKey: 'v44ZAwFgdPMXaS8vFEkqlvKfqf3wlhxS1WrpB7KAG7=',
    secretKey: 'Ejw9fWXkfzKBjwC6ms0h2y...HxbMLKCJINwBrZgDGzFlKYQCjHdEYEknHsdoFNc2bwwO='
  },
  encryption: {
    publicKey: 'XKLCZ4oO6KqfTnFFeY4kr3EKs0V98eSbSyUjDROxX=',
    secretKey: 'A5p7EN8Kmxk9lm7xqjxF6Z6IVIkP3ZO8533agYEVz='
  }
}
```

### `create(scope, seed)`

In some cases we need to generate a keyset from a known seed. We can pass that seed to `create` as a second parameter.

```ts 
const ephemeralKeys = keyset.create({ type: EPHEMERAL }, seed)
```

### `redact(secretKeyset)`

There are two kinds of keysets: 

- **`KeysetWithSecrets`** includes the secret keys  
  (for example, our user or device keys, or keys for roles we belong to)
- **`PublicKeyset`** only includes the public keys  
  (for example, other users' keys, or keys for roles we don't belong to)

The `redact` function takes a `KeysetWithSecrets`, and returns a `PublicKeyset`.

```ts
const publicKeyset = keyset.redact(adminKeys)

{
	type: 'ROLE', 
  name: 'admin',
  generation: 0,
  signature: 'v44ZAwFgdPMXaS8vFEkqlvKfqf3wlhxS1WrpB7KAG7=', // = adminKeys.signature.publicKey
  encryption: 'XKLCZ4oO6KqfTnFFeY4kr3EKs0V98eSbSyUjDROxX=', // = adminKeys.encryption.publicKey
}
```

