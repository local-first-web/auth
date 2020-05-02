# 🌮 taco-js

Decentralized authentication and authorization for team collaboration, using a secure chain of
cryptographic signatures.

## Why

💻🤝 You're building a [local-first](http://inkandswitch.com/local-first.html) app to enable distributed collaboration [without a central
server](http://medium.com/all-the-things/a-web-application-with-no-web-server-61000a6aed8f).

👩🔑 You want to **authenticate** users and manage their **permissions**.

🚫☁ You **don't** want to depend on a centralized authentication server or a key management service.

👌❤ You want to provide a **easy and seamless experience** to users creating and joining teams

🎛🤪 You **don't** want to expose any of the underlying cryptographic complexity.

## How

When Alice first creates a team, she is assigned a set of **device-specific keys** for signatures,
asymmetric encryption, and symmetric encryption. These are stored in her device's **secure storage**,
and the secret keys will **never leave that device**.

She writes the first link of a **signature chain**, containing her public keys for signatures and
encryption. All subsequent links must be signed by Alice or by another team member with admin
permissions.

Subsequent links in the chain can serve to add new team members, authorize new devices, define
roles, and assign people to roles.

Invitations, permissions, and device authorizations can also be **revoked**, in which case secret keys
are **rotated** and associated data **re-encrypted**.

👉 Learn more: [Internals](./docs/internals.md)

## What

Taco exposes a single `Team` class.

You get a `Team` object back that wraps the signature chain and encapsulates the team's members,
devices, and roles. This object can also use the public keys embedded in the signature chain, along
with the user's own secret keys, to provide encryption, decryption, signatures, and signature
verification within the team.

#### Not included

- **Storage** Taco uses the secure storage provided by the device to store the user's keys.
  Otherwise Taco does **not** deal with storage for the signature chain.
- **Networking** Taco does not deal with networking for sending invitations or for keeping
  signature chains in sync across devices.

### Examples

```bash
yarn add taco-js
```

#### Alice creates a new team

```ts
import { Team } from 'taco'

const context = { localUser: 'alice', device: 'windows laptop 2020' }
const team = new Team({ name: 'Spies Я Us', context })
```

Usernames (`alice` in the example) identify a person uniquely within the team. You could use existing user IDs or names, or email addresses.

#### Alice invites Bob

```ts
const invitationKey = team.members.invite('bob')
```

The invitation key is a single-use 16-character string like `aj7x d2jr 9c8f zrbs`. To make it easier to retype if needed, it is in base-30 format, which omits easily confused characters. This is a secret that only Alice and Bob will ever know. It might be typed directly into your application, or appended to a URL that Bob can click to accept:

> Alice has invited you to team XYZ. To accept, click: http://xyz.org/accept/aj7xd2jr9c8fzrbs

Alice will send the invitation to Bob via a pre-authenticated channel.

- If the stakes are low, she could use email or SMS
- If more security is needed, she could use an encrypted service like WhatsApp, Telegram, or Signal

#### Bob accepts the invitation

```ts
team.members.accept('aj7x d2jr 9c8f zrbs')
```

#### Alice defines a role

```ts
team.roles.create('managers', { isAdmin: true })
```

#### Alice adds Bob to this role

```ts
team.roles.addUser('managers', ['bob'])
```

#### Alice checks Bob's permissions

```ts
const isAdmin = team.roles.isAdmin('bob')
```

#### Alice encrypts a message for managers

```ts
const message = 'the condor flies at midnight'
const { encrypt, decrypt } = team.crypto.asymmetric
const cipher = encrypt(message, { roles: ['managers'] })
```

#### Bob decrypts the message

```ts
const { encrypt, decrypt } = team.crypto.asymmetric
const decryptedMessage = decrypt(cipher) // 'the condor flies at midnight'
```

👉 Learn more: [API documentation](./docs/api.md).

## Prior art

💡 This project is inspired by and borrows heavily from Keybase: The signature chain is inspired by [their implementation for Teams](https://keybase.io/docs/team), and the invitation mechanism is based on their [Seitan token exchange specification](https://keybase.io/docs/teams/seitan_v2), proposed as a more secure alternative to TOFU, or _**T**rust **O**n **F**irst **U**se_.

TACO stands for _**T**rust **A**fter **C**onfirmation **O**f invitation_.
