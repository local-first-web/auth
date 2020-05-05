## 🔐📦 Lockbox

A lockbox allows you to encrypt content once for multiple readers.

For example, you can encrypt a dataset for an entire team using a secret symmetric key, and distribute one lockbox per team member. Each lockbox consists of a copy of the secret key, encrypted asymmetrically using the team's private key and the member's public key.

You only need to know the public half of the recipients' encryption key. You don't need a trusted side channel to communicate with the recipients, and you never have to transmit the secret in cleartext. The lockboxes are clearly labeled and can be attached to the encrypted content for storage, publication, or transmission.

A lockbox is just data:

```ts
const lockbox = {
  sender: 'Spies Я Us',
  senderPublicKey: 'fUeVMZIzch2ZIIKB6rvzBQ4kSlc4ZfzgGhrFX48vBaHXH',
  recipient: 'bob',
  recipientPublicKey: 'rrhT32xnIJyQVTGrEkkgUS1FToPfXcNMkUh1xqp5dfhCrE',
  scope: 'team',
  encryptedSecret:
    'r1peeKn3MnndwaEFqBJbY0rr9eps0vxhpZFHjtV33xTfcGrrrFqHsv8+vj3EB5tJc2K9X8krrD9RJzeHDMuoeQqqpRRkaw9==',
}
```

We use lockboxes to:

- share per-team keys with team members
- share per-role keys with members in that role
- share per-user keys with the user's devices
