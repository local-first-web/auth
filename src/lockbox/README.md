## 🔐📦 Lockbox

A lockbox allows you to encrypt content once for multiple readers.

For example, you can encrypt a dataset for an entire team using a secret symmetric key, and
distribute one lockbox per team member. Each lockbox consists of a copy of the secret key, encrypted
asymmetrically using the team's private key and the member's public key.

You only need to know the public half of the recipients' encryption key. You don't need a trusted
side channel to communicate with the recipients, and you never have to transmit the secret in
cleartext. The lockboxes are clearly labeled and can be attached to the encrypted content for
storage, publication, or transmission.

A lockbox is just data:

```ts
const lockbox = {
  scope: 'role',
  name: 'admin',
  publicKey: 'fUeVMZIzch2ZIIKB6rvzBQ4kSlc4ZfzgGhrFX48vBaHXH',
  recipient: 'bob',
  recipientPublicKey: 'rrhT32xnIJyQVTGrEkkgUS1FToPfXcNMkUh1xqp5dfhCrE',
  encryptedSecret: 'r1peeKn3MnndwaEFqBJbY0rr9eps0vxhpZFHjtV33xTfcGrrrFqHsv8...w9==',
}
```

The "sender" keys used to encrypt the lockbox are generated randomly. The public half of this
single-use key is posted publicly on the lockbox; the secret half is used to encrypt the lockbox
contents.

We use lockboxes to:

- share per-team keys with team members
- share per-role keys with members in that role
- share per-user keys with the user's devices

#### `create()`

To make a lockbox:

```ts
import { create } from '/lockbox'
create({
  scope: 'role',
  name: 'managers',
  recipient: carol,
  secret: 'passw0rd',
})
```
