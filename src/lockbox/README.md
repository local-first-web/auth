## 🔐📦 Lockbox

A lockbox allows you to **encrypt content once for multiple readers**.

<img src='../../docs/img/lockboxes.png' width='500' />

For example, you can **encrypt a dataset once for an entire team using a single secret key**, and
**distribute one lockbox per team member containing the secret key**. In each lockbox, the secret key is encrypted
asymmetrically using an ephemeral private key and the member's public key.

To encrypt content using lockboxes, you only need to know the public half of the recipients' encryption key. You don't need a trusted
side channel to communicate with the recipients, and you never have to transmit the secret in
cleartext. The lockboxes are clearly labeled and can be attached to the encrypted content for
storage, publication, or transmission.

A lockbox is just data: An encrypted payload, plus some metadata.

For example:

```ts
const lockbox = {
  // need this to open the lockbox
  encryptionKey: {
    scope: 'EPHEMERAL',
    publicKey: 'uwphz8qQaqNbfDx9JhvgOWt9hOgfNR3eZ0sgS1eFUP6QX25Q',
  },

  // information to identify the key that can open this lockbox
  recipient: {
    scope: 'USER',
    name: 'alice',
    publicKey: 'x9nX0sBPlbUugyai9BR0A5vuZgMCekWodDpbtty9CrK7u8al',
  },

  // information about the contents of the lockbox
  contents: {
    scope: 'ROLE',
    name: 'admin',
    publicKey: 'BmY3ZojiKMQavrPaGc3dp7N1E0nlw6ZtBvqAN4rOIXcWn9ej',
  },

  // the payload
  encryptedSecret: 'BxAOzkrxpu2vwL+j98X9VDkW6cKqDoDQUNM2dJ9dXDsr...2wKeaT0T5wi0JVGh2lbW2VG5==',
}
```

The lockbox is encrypted using a single-use, randomly-generated key. The public half of this
ephemeral key is posted publicly on the lockbox; the secret half is used to encrypt the lockbox
contents, and is then discarded.

We use lockboxes to:

- share **team keys** with team **members**
- share **role keys** with **members** in that role
- share **all role keys** with the **admin role**
- share **user keys** with the user's **devices**

#### `create()`

To make a lockbox, pass in two keysets:

- `contents`, the keys to be encrypted in the lockbox
- `recipient`, the keys used to open the lockbox

This makes a lockbox for Alice containing the admin keys.

```ts
import * as lockbox from '/lockbox'

const adminKeysForAlice = lockbox.create({
  contents: {
    scope: 'ROLE',
    name: 'admin',
    seed: 'CrVdFPwluPaVIHUS22I0LrJOM47wCOnN853V3OonqnToO9i5',
  	publicKey: 'CSiD5BxujROcznaLdfowq9W8d4voS8CGL06fOuiyHO7trRml',
  },
  recipient: {
  	scope: 'USER',
  	name: 'alice',
  	publicKey: 'JG81tVDDfp3BqXedrtiRiWtvqQKt2175nAceYIPjjMR7z2Y1',
	}
)
```

This example illustrates the minimal data that `create` needs to make a lockbox. In practice, we're more likely to just pass two `Keyset` objects, and the function will take what it needs from each:

```tsx
const adminKeysForAlice = lockbox.create({
  contents: adminKeys,
  recipient: aliceKeys,
})
```

#### `open()`

To
