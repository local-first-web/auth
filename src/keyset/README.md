## 🔑🗝 Keyset

Each team, each role, each user, and each device has its own **keyset**. A keyset consists of two keypairs - one for encryption and one for signatures. (The secret key of the encryption keypair is used for symmetric encryption.)

A keyset is generated from a single randomly-generated secret, following a procedure roughly based on the [Keybase docs on Per-User Keys](http://keybase.io/docs/teams/puk).

Each keyset is associated with a **scope**, which could be:

- an entire **team**: `{ type: TEAM }`
- a specific **role**: `{ type: ROLE, name: 'admin' }`
- a specific **member**: `{ type: MEMBER, name: 'alice' }`
- a specific **device**: `{ type: DEVICE, name: 'alice laptop' }`
- **ephemeral** (a throwaway or single-use keyset): `{ type: EPHEMERAL }`

### `create(scope)`

```ts
const adminKeys = keyset.create({type: ROLE, name: 'admin'})

{
	type: 'ROLE', 
  name: 'admin',
  generation: 0,
  signature: {
    publicKey: 'v44ZAwFgdGBbxPMXaS8vFEkq08lvKfqf3wlhxS1WrpB7KAG7=',
    secretKey: 'Ejw9fWXkfuNS5zKBjwC628ms0h2y...HxbMLKCJINwBrZgDGzFlKYQCjHdEYEknHsdoFNc2bwwO='
  },
  encryption: {
    publicKey: 'XKLCZ4oO6KqfTngvpxFFe4jY4kr3EKs0V98eSbSZyUjDROxX=',
    secretKey: 'A5p7EN8Kmxk9lmvRh57xqN0jxF6Z6IVIkP3ZO8533agYEVzK='
  }
}
```

### `redact(secretKeyset)`

There are two kinds of keysets: ones where we know the secret keys (`KeysetWithSecrets`), and ones where we only know the public keys (`PublicKeyset`). 

The `redact` function takes a keyset that includes secret keys (`KeysetWithSecrets`), and returns a keyset with just the public keys (`PublicKeyset`).

```ts
const publicKeyset = keyset.redact(adminKeys)

{
	type: 'ROLE', 
  name: 'admin',
  generation: 0,
  encryption: 'Yxb5B79mNvtDg9kjvDHIlFK4pu8XvXT0to9TtILijig=',
  signature: 'xvIoa0SjV7C+tIwVLaGAXSWLH/H8KwC3BVMsQO68Er4=',
}
```
