<img src="https://raw.githubusercontent.com/local-first-web/branding/main/svg/auth-h.svg"
width="600" alt="@localfirst/auth logo" />

`@localfirst/auth` is a TypeScript library providing **decentralized authentication and
authorization** for team collaboration, using a replicated graph of operations that are
cryptographically signed, encrypted, and linked.

## Why

🤝 You're building a [local-first](http://inkandswitch.com/local-first.html) app to enable
distributed collaboration [without a central
server](http://medium.com/all-the-things/a-web-application-with-no-web-server-61000a6aed8f).

🔑 You want to **authenticate** users and manage their **permissions**.

🚫 You **don't** want to depend on a centralized authentication server or a key management service.

💙 You want to provide a **easy and seamless experience** to users creating and joining teams.

🤔 You **don't** want to expose any of the underlying cryptographic complexity.

## How it works

This library uses a custom CRDT based on an encrypted graph of signed changes (provided by the
[CRDX](/packages/crdx/README.md) library) to manage team membership, permissions, and
authentication in a principled way and without a central .

All changes to the team's membership and permissions are recorded on the graph as a sequence of
**signed** and **hash-chained** actions.

![](/docs/img/sigchain-med.png)

Every team member keeps a complete replica of the team's graph and can validate other members'
actions independently. All **authorizations** can be traced back to the root action, created by the
team's founding member. The chain thereby builds a **tamper-proof, distributed web of trust**.

New members and devices are added to the team with **invitations** following a [Seitan token
exchange](https://book.keybase.io/docs/teams/seitan). To invite a new member or authorize a new
device, you generate a secret and record enough information about the invitation on the graph so
that any team member can verify that the new member or device knows the secret.

Once admitted to the team, each member generates their own cryptographic keys for signatures and
encryption. They also generate **device-level keys** that are stored in each devices' secure
storage, and which never leave the device.

When roles are changed, members leave, or devices are lost or replaced, keys are **rotated** and
associated data **re-encrypted**.

In this way the team's graph acts as a **self-contained certificate authority** or **public key
infrastructure** (PKI) solution. At any point in time we calculate the team's current state from it,
which includes each member's current public keys, as well as their status and roles, and the public
keys of each of their devices.

Internally, this library uses those keys

- to **verify the authorship** of changes to the team graph;
- to **encrypt and decrypt the graph**;
- to **authenticate peers** when connecting to them; and
- to create an **encrypted channel** when communicating with peers.

But much more can be built on top of this facility. Cryptography [turns problems into key management
problems](https://twitter.com/LeaKissner/status/1198595109756887040), and key management has always
revolved almost entirely around some kind of centralized server. By providing a purely decentralized
way to link public keys to people and devices, this library opens up a number of exciting
possibilities for local-first apps.

👉 Learn more: [Internals](/docs/internals.md)

## What's included

The core library, [`@localfirst/auth`](/packages/auth/README.md), provides two main classes:

- The `Team` class, which wraps the graph and encapsulates the team's members, devices, and roles.
  With this object, an application can **invite new members** and **manage their permissions**. This
  object can also use members' and devices' public keys to provide **encryption** and **signature
  verification** within the team.

- The `Connection` class, which implements a protocol for devices to **mutually authenticate each
  other**, and creates an **encrypted channel** for an application to communicate over.

The [`@localfirst/auth-provider-automerge-repo`](/packages/auth-provider-automerge-repo/README.md)
package makes it possible to create authenticated and encrypted connections with peers using
[automerge-repo](https://github.com/automerge/automerge-repo). Also is included is
[`@localfirst/auth-syncserver`](/packages/auth-syncserver/README.md), a version of the automerge-repo
sync server that works with this library.

## Demo

This repo includes a demo TodoMVC-type app in [`demos/automerge-repo-todos`](/packages/automerge-repo-todos), showing how you might build an
secure local-first app, using automerge-repo for the application data and @localfirst/auth for
authentication.

```bash
pnpm dev
```

## Usage

```bash
pnpm add @localfirst/auth
```

#### Alice creates a new team

```js
import { createUser, createDevice, createTeam } from '@localfirst/auth'

// 👩🏾 Alice
const user = createUser('alice')
const device = createDevice(user.userId, `alice's laptop`)
const team = createTeam('Spies Я Us', { user, device })
```

The name given to the user (`alice` in the example) might be something that identifies the user
_outside_ of @localfirst/auth, like an email or a username. The `userId` is an automatically
generated CUID like .

#### Alice invites Bob

```js
// 👩🏾 Alice
const { secretKey } = team.inviteMember()
```

The invitation key is a single-use secret that only Alice and Bob should ever see. By default, it is
a 16-character string like `aj7xd2jr9c8fzrbs`. It could be typed directly into your application, or
displayed as a QR code, or appended to a URL that Bob can click to accept:

> Alice has invited you to team XYZ. To accept, click: http://xyz.org/accept/aj7xd2jr9c8fzrbs

Alice will send the invitation to Bob via a side channel she already trusts (phone call, email, SMS,
WhatsApp, Telegram, etc).

#### Bob accepts the invitation

Bob uses the secret invitation key to generate proof that he was invited, without divulging the key.

```js
// 👨🏻‍🦲 Bob
import { generateProof } from '@localfirst/auth'
const proofOfInvitation = generateProof('aj7xd2jr9c8fzrbs')
```

When Bob shows up to join the team, anyone can validate his proof of invitation to admit him to the
team - it doesn't have to be an admin.

```js
// 👳🏽‍♂️ Charlie
team.admitMember(proofOfInvitation, bob.keys, 'bob')
const success = team.has('bob') // TRUE
```

#### Alice defines a role and adds Bob

```js
// 👩🏾 Alice
team.addRole('managers')
team.addMemberRole('bob', 'managers')
```

#### Alice checks Bob's role membership

```js
// 👩🏾 Alice
const isAdmin = team.isAdmin('bob') // TRUE
```

#### Alice encrypts a message for managers

```js
// 👩🏾 Alice
const message = 'the condor flies at midnight'
const encrypted = team.encrypt(message, 'managers')
```

#### Bob decrypts the message

```js
// 👨🏻‍🦲 Bob
const decrypted = team.decrypt(encrypted) // 'the condor flies at midnight'
```

👉 Learn more: [API documentation](/docs/api.md).

## Prior art

💡 This project borrows heavily from [Keybase](https://keybase.io). The graph is inspired by the
"signature chain" used to implement [Keybase Teams](https://book.keybase.io/docs/teams), and the
invitation mechanism is based on their [Seitan token exchange
specification](https://book.keybase.io/docs/teams/seitan), proposed as a more secure alternative to
TOFU (Trust On First Use).

🌮 This library was originally called `taco-js`, where TACO stood for _**T**rust **A**fter
**C**onfirmation **O**f invitation_.
