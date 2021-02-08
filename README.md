<img src="https://raw.githubusercontent.com/local-first-web/branding/main/svg/auth-h.svg" width="600" alt="@localfirst/auth logo" />

`@localfirst/auth` provides **decentralized authentication and authorization** for team collaboration, using a secure chain of
cryptographic signatures.

> 🚧 **Note:** This is a work in progress. 

## Why

🤝 You're building a [local-first](http://inkandswitch.com/local-first.html) app to enable distributed collaboration [without a central server](http://medium.com/all-the-things/a-web-application-with-no-web-server-61000a6aed8f).

🔑 You want to **authenticate** users and manage their **permissions**.

🚫 You **don't** want to depend on a centralized authentication server or a key management service.

💙 You want to provide a **easy and seamless experience** to users creating and joining teams

🤔 You **don't** want to expose any of the underlying cryptographic complexity.

## How

This library solves the following problems without requiring a server or any other central source of truth:

- **Authorization**, using a signature chain
- **Authentication**, using signature challenges
- **Invitations**, using a Seitan token exchange
- **Multi-reader encryption**, using lockboxes
- **Key revocation and rotation**, using an acyclic directed graph of keys and lockboxes

Each user and each device is assigned a set of cryptographic keys for signatures, asymmetric
encryption, and symmetric encryption.

When Alice first creates a team, she writes the first link of a **signature chain**, containing her
public keys for signatures and encryption. All subsequent links must be signed by Alice or by
another team member with admin permissions.

Subsequent links in the chain can serve to add new team members, authorize new devices, define
roles, and assign people to roles.

When roles are changed, members leave, or devices are lost or replaced, keys are **rotated** and
associated data **re-encrypted**.

👉 Learn more: [Internals](./docs/internals.md)

## What

This library provides a `Team` class, which wraps the signature chain and encapsulates the team's members,
devices, and roles. With this object, you can **invite new members** and **manage their
permissions.**

This object can also use the public keys embedded in the signature chain, along with the user's own
secret keys, to provide **encryption** and **signature verification** within the team.

It also includes a `Connection` object that implements a protocol for **authenticating** and **synchronizing** the team's signature chains between two peers. 

#### Not included

- **Storage** This library does not provide storage for user information (including keys) or the
  signature chain.
- **Networking** You need to provide a working socket connecting us to a peer.

### Examples

```bash
yarn add @localfirst/auth
```

#### Alice creates a new team

```js
import * as auth from '@localfirst/auth'

// 👩🏾 Alice
const user  = auth.createUser('alice')
const device = auth.createDevice('alice', 'laptop')
const team = auth.createTeam({ name: 'Spies Я Us', context: { user, device } })
```

**User names** (`alice` in the example) identify a person uniquely within the team. You could use existing user IDs or names, or email addresses, or anonymized hashes:

```js
const user = auth.createUser('alice@spies.org')
const user = auth.createUser('002309')
const user = auth.createUser('XPVfE0JDpDrVQaXQbqPKRGm6')
```

**Device names** just need to be unique among a user’s devices. 

#### Alice invites Bob

```js
// 👩🏾 Alice
const { secretKey } = team.invite('bob')
```

The invitation key is a single-use secret that only Alice and Bob will ever know. By default, it is
a 16-character string like `aj7x d2jr 9c8f zrbs`, and to make it easier to retype if needed, it is
in base-30 format, which omits easily confused characters. It might be typed directly into your
application, or appended to a URL that Bob can click to accept:

> Alice has invited you to team XYZ. To accept, click: http://xyz.org/accept/aj7x+d2jr+9c8f+zrbs

Alice will send the invitation to Bob via a side channel she already trusts (phone call, email, SMS,
WhatsApp, Telegram, etc).

#### Bob accepts the invitation

Bob uses the secret invitation key to generate proof that he was invited, without divulging the key.

```js
// 👨🏻‍🦲 Bob
const proofOfInvitation = auth.generateProof('aj7x d2jr 9c8f zrbs', 'bob')
```

When Bob shows up to join the team, anyone can validate his proof of invitation to admit him to the
team - it doesn't have to be an admin.

```js
// 👳🏽‍♂️ Charlie
team.admit(proofOfInvitation)
const success = team.has('bob') // TRUE
```

#### Alice sets Bob’s roles

Alice can create a role and add Bob to it. 

```js
// 👩🏾 Alice
team.addRole('managers')
team.addMemberRole('bob', 'managers')
```

Alice checks Bob's role membership:

```js
// 👩🏾 Alice
const isManager = team.memberHasRole('bob', 'managers') // TRUE
```

The `admin` role is special, as it allows a member to modify the group by inviting or removing members, creating roles and assigning members to them, and so on. 

```js
team.addMemberRole('bob', 'admin')
const isAdmin = team.memberIsAdmin('bob') // TRUE
```

#### Alice encrypts a message for Bob

```js
// 👩🏾 Alice
const message = 'the condor flies at midnight'
const encrypted = team.encrypt(message, 'managers')
```

Bob decrypts the message:

```js
// 👨🏻‍🦲 Bob
const decrypted = team.decrypt(encrypted) // 'the condor flies at midnight'
```

#### Alice and Bob connect over a network

The examples above show how to use the invitation process manually. The `Connection` class encapsulates a complete communications protocol as a Duplex stream, allowing two peer devices to authenticate each other, synchronize, and encrypt communications. 

```js
const bobSocket = getWebSocketFromSomewhere()
const aliceConnection = new Connection({user, device, team})
connection.start()

aliceConnection.pipe(bobSocket).pipe(aliceConnection)
```

👉 Learn more: [API documentation](./docs/api.md).

## Prior art

💡 This project is inspired by and borrows heavily from Keybase: The signature chain is inspired by
[their implementation for Keybase Teams](https://keybase.io/docs/team), and the invitation mechanism
is based on their [Seitan token exchange specification](https://keybase.io/docs/teams/seitan_v2),
proposed as a more secure alternative to TOFU, or _**T**rust **O**n **F**irst **U**se_.

🌮 This library was originally called `taco-js`. TACO stands for _**T**rust **A**fter **C**onfirmation **O**f invitation_.
