# Internals

## 👩🏾📱 Users, devices, and keys

TODO

## 📪⚛️ The CRDX store

###

TODO

### Action types

TODO

### The reducer

TODO

### The resolver

TODO

## 💌💌 Invitations

TODO

## 🔐📦 Lockboxes

A lockbox allows you to **encrypt content once for multiple readers**.

<img src='img/lockboxes.png' width='500'>

For example, you can **encrypt a dataset once for an entire team using a single secret key `T`**, and
**distribute one lockbox per team member containing the secret key**. In each lockbox, the secret key is encrypted
asymmetrically using an ephemeral private key and the member's public key.

To encrypt content using lockboxes, you only need to know the recipients' public keys. You don't need a trusted
side channel to communicate with the recipients, and you never have to transmit the secret in
cleartext. The lockboxes are clearly labeled and can be attached to the encrypted content for
storage, publication, or transmission.

A lockbox is just data: An encrypted payload, plus some metadata.

For example:

```js
const lockbox = {
  // need this to open the lockbox
  encryptionKey: {
    type: 'EPHEMERAL',
    publicKey: 'uwphz8qQaqNbfDx9JhvgOWt9hOgfNR3eZ0sgS1eFUP6QX25Q',
  },

  // information to identify the key that can open this lockbox
  recipient: {
    type: 'USER',
    name: 'alice',
    publicKey: 'x9nX0sBPlbUugyai9BR0A5vuZgMCekWodDpbtty9CrK7u8al',
  },

  // information about the contents of the lockbox
  contents: {
    type: 'ROLE',
    name: 'admin',
    publicKey: 'BmY3ZojiKMQavrPaGc3dp7N1E0nlw6ZtBvqAN4rOIXcWn9ej',
  },

  // the encrypted keyset
  encryptedPayload: 'BxAOzkrxpu2vwL+j98X9VDkcKqDoDQUNM2dJ9dXDsr...2wKeaT0T5wi0JVGh2lbW2VG5==',
}
```

The lockbox contents are encrypted using a single-use, randomly-generated key. The public half of this
ephemeral key is posted publicly on the lockbox; the secret half is used to encrypt the lockbox
contents, and is then discarded.

We use lockboxes to:

- share **team keys** with team **members**
- share **role keys** with **members** in that role
- share **all role keys** with the **admin role**
- share **user keys** with the user's **devices**

### The key graph

Keys provide access to other keys, via lockboxes; so we have an acyclic directed graph where keys are nodes and
lockboxes are edges.

![](img/key-graph.png)

Note that "acyclic" describes what honest peers produce, not what the format guarantees. Any member can post a lockbox holding a keyset they minted themselves, naming any scope and any generation, so the graph a peer replays is only as well-shaped as the links on it.

### Cycles

Nothing in a lockbox says which way the graph runs, so a member can post `create(k1, k2)` alongside `create(k2, k1)` and make the edges point at each other. Both walks over the key graph — `visibleKeys`, which opens lockboxes, and `visibleScopes`, which reads their manifests — carry a visited set for this reason. Aimed at one member's own scope, an unguarded walk took away both of the remediations the team has against that member: they could no longer be removed and no longer be re-keyed, by anybody, permanently.

### A member can displace a scope's keys

**This includes the team keys, and it takes one link from a member with no roles at all.** Lockbox manifests are plaintext, so the public key of every member's user keyset is on the graph. A member mints a keyset of their own, names it `TEAM`, and posts one lockbox per member addressed to those user keys — the same pairing `createTeam` and `admitMember` produce, so nothing at the door can refuse it. Every member who replays that link, admins included, then treats the forger's keyset as the team keys. They get no error. What they encrypt for the team, the forger can read and the rest of the team cannot.

The same works for a role, addressed to an admin's user keys. It propagates from there: `team.addMemberRole` puts the role keys *as the granting admin sees them* into a lockbox for the new member, so a displaced admin hands the forged keyset to members who never saw the forgery.

**Recovery: rotate the scope.** Rotating appends the replacement to the graph's own record of the keysets a scope has carried, and that record — not the `generation` number written inside a lockbox — is what decides which keyset is current. So the replacement takes over regardless of what the forgery claimed.

| what was displaced | what to run |
| --- | --- |
| the team keys | `team.remove(forger)` — removing any member rotates the team keys |
| a role's keys | `team.addMemberRole(someone, role)` then `team.removeMemberRole(someone, role)` |
| a member's own keys | `team.changeKeys(...)` for yourself, or an admin re-keys you |

**How you would notice.** This is the hard part, and there is no reliable alarm. The displaced member gets no error, and if everybody has been displaced they all agree with each other, so nothing local looks wrong. Two things are observable:

- **The generation isn't where your own history says it should be.** A scope's generation counts the keysets the graph has carried for it, so after each rotation you perform it should go up by exactly one. A jump, or a drop — a rotation taking it from 9 to 2 — means the graph carried keysets nobody on the team created.
- **Peers disagree.** Members who should share a scope's keys fail to decrypt each other's messages for it.

If you have reason to think a scope was forged over, rotate it; rotating a scope that was fine costs nothing but a round of re-encryption.

### The rule this is all an instance of

Four separate security fixes in this area turned out to be the same bug wearing different hats, because each one moved an authority off one attacker-writable quantity and onto another. The rule that would have caught all four:

> **No selector may treat a quantity derived from the lockbox graph as authoritative unless the graph itself assigns it.**

A member can post a lockbox naming any scope, generation and recipient, so everything *written in* a lockbox is an assertion by its author. The one quantity here that isn't is `state.keyHistory`: the reducer appends a scope's keyset the first time the graph carries it, in replay order, so a member moves it by one slot per lockbox they actually post and cannot claim a position. Where these sites stand:

| site | what it decides | status |
| --- | --- | --- |
| `selectors/keys` | which generation of a scope is current | **satisfies** — resolved from `keyHistory` order, not from the highest `generation` held |
| `Team.rotateKeys` | the generation a rotation writes | **satisfies** — `keyHistory.length` |
| `Team.updateUserKeys` | when to adopt new keys for ourselves | **satisfies** — asks `select.keys`, having previously compared `generation` fields |
| `selectors/keyMap` | which keyset wins when two claim the same generation | **exception** — the slot is author-asserted. First on the graph wins, which is the conservative choice: it can only ever keep a keyset the team already had |
| `selectors/lockboxesInScope` | who gets a replacement when a scope rotates | **exception** — grouped by the recipient scope on the manifest, which is author-asserted. Conservative in the same way: a finer grouping only ever adds recipients to a rotation, never drops one |
| `connection/getDeviceUserFromGraph` | which user keys a joining device adopts | **open** — takes `getLatestGeneration` over a keyring built from the graph, which is the shape fixed in `updateUserKeys` |

The two exceptions are recorded rather than fixed because both fail safe: they can add work or keep an older keyset, but neither can hand over a keyset the team never had. Any new selector reading the lockbox graph should be checked against the rule above and added to this table.

## API

#### `lockbox.create(contents, recipientKeys)`

To make a lockbox, pass in two keysets:

- `contents`, the secret keys to be encrypted in the lockbox. This has to be a `KeysetWithSecrets`.
- `recipientKeys`, the public keys used to open the lockbox. At minimum, this needs to include the recipient's public encryption key (plus metadata for scope and generation).

This makes a lockbox for Alice containing the admin keys.

```js
import * as lockbox from 'lockbox'

const adminLockboxForAlice = lockbox.create(adminKeys, alice.keys)
```

This illustrates the minimum information needed to create a lockbox:

```js
const adminLockboxForAlice = lockbox.create(
  {
    type: 'ROLE',
    name: 'admin',
    generation: 0,
    signature: {
      publicKey: 'B3B8xMFdLDLbd72tXLlgxyvsAJravbATqMtTtje1PQdikGjN=',
      privateKey: 'QI4vBzCKvn6SBvyR7PBKFuuKiSGk3naX0oetx3XUtPK...AX1W0LCdWwMlHhNO3T5jVwnkz=',
    },
    encryption: {
      publicKey: 'asuM3NexDiDs2P2OKQOu3tdXWz2zV6LoaxPfZPLIb8gFIIU0=',
      privateKey: 'e1tcEjpGfKuJz8JObrVJGqq9zrXpNwyHafYEd298p3MyYThJ=',
    },
  },
  {
    type: 'USER',
    name: 'alice',
    generation: 0,
    publicKey: 'JG81tVDDfp3BqXedrtiRiWtvqQKt2175nAceYIPjjMR7z2Y1',
  }
)
```

#### `lockbox.open(lockbox, decryptionKeys)`

To open a lockbox:

```js
const adminKeys = open(adminLockboxForAlice, alice.keys)
```

#### `lockbox.rotate(oldLockbox, contents)`

"Rotating" a lockbox means replacing the keys it contains with new ones.

When a member leaves a team or a role, or a device is lost, we say the corresponding keyset is
'compromised' and we need to replace it -- along with any keys that it provided access to.

For example, if the admin keys are compromised, we'll need to come up with a new set of keys; then
we'll need to find every lockbox that contained the old keys, and replace them with the new ones.

```js
const newAdminKeys = createKeyset({ type: ROLE, name: ADMIN })
const newAdminLockboxForAlice = lockbox.rotate(adminLockboxForAlice, newAdminKeys)
```

We'll also need to so the same for any keys _in lockboxes that the those keys opened_.

![](img/key-rotation.png)

This logic is implemented in the private `rotateKeys` method in the `Team` class.

## `Team`

TODO

## `Connection`

TODO
