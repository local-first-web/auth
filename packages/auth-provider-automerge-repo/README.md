<img src="https://raw.githubusercontent.com/local-first-web/branding/main/svg/auth-h.svg" width="300" alt="@localfirst/auth logo" />

## Local-first auth provider for Automerge Repo

This is an `AuthProvider` that uses the [localfirst/auth](/local-first-web/auth) library to provide
[Automerge Repo](/automerge/automerge-repo) with authentication and end-to-end encryption, without
the need for a central server.

It works by wrapping the network provider(s) used by the `Repo`.

### Making an authenticated connection

A `AuthProvider` is configured with information about the local user and device.

```ts
import { createUser, createDevice } from '@localfirst/auth'
import { AuthProvider } from '@localfirst/auth-provider-automerge-repo'

// Create the user & device, or retrieve them from storage.
// These objects include secret keys, so need to be stored securely.
const user = createUser('alice')
const device = createDevice(alice.userId, 'ALICE-MACBOOK-2023')

// Use the same storage adapter for the `AuthProvider` and the `Repo.`
const storage = new SomeStorageAdapter()

// Instantiate the auth provider.
const authProvider = new AuthProvider({ user, device, storage })

// Use it to wrap your network adapter.
const adapter = new SomeNetworkAdapter()
const network = [authProvider.wrap(adapter)]

// Instantiate the repo.
const repo = new Repo({ network, storage })
```

The context for authentication is a localfirst/auth team. For example, Alice might create a team
and invite Bob to it.

```ts
// Alice creates a team
const team = authProvider.createTeam('team A')

// (this is a shorthand for creating the team yourself and adding it to the team)
// const team = Auth.createTeam('team A', aliceContext)
// authProvider.addTeam(team)

// Alice creates an invitation code to send to Bob
const { seed: bobInviteCode } = team.inviteMember()
```

Alice now needs to communicate this code, along with the team's ID, to Bob, using an existing
communications channel that she trusts. For example, she could send it via WhatsApp or Signal or
email; or she could create a QR code for Bob to scan; or she could read it to him over the phone.

Bob sets up his auth provider and his repo much like Alice did:

```ts
const user = createUser('bob')
const device = createDevice(bob.userId, 'BOB-IPHONE-2023')
const storage = new SomeStorageAdapter()
const authProvider = new AuthProvider({ user, device, storage })
const adapter = new SomeNetworkAdapter()
const network = [authProvider.wrap(adapter)]
const repo = new Repo({ network, storage })
```

Bob registers his invitation with the team:

```ts
bobAuthProvider.addInvitation({
  shareId: aliceTeam.id,
  invitationSeed: bobInviteCode,
})
```

If all goes well, Alice's repo and Bob's repo will each receive a `peer` event, just like without
the auth provider — but with an authenticated peer on the other end, and an encrypted channel for
communication.

Here's how that works under the hood:

- The `AuthProvider` wraps the network adapter so it can intercept its messages and events.
- We intercept the adapter's `peer-candidate` event, and before surfacing it to the repo we run the
  localfirst/auth connection protocol over that channel.
- In this case, Bob sends Alice cryptographic proof that he has the invitation code; and Alice can
  use that proof to validate his invitation and admit him to the team. He gives her his public keys,
  which she records on the team.
- Alice then sends him the team's serialized graph, so he has a complete copy. He can use this to
  verify that this is in fact the team he was invited to, and to obtain Alice's public keys.
- Alice and Bob use each other's public keys to exchange asymmetrically encrypted seed information
  and agree on a session key, which they begin using to symmetrically encrypt further communication.
- Once that is done, the authenticated network adapter re-emits the `peer-candidate` event to the
  network subsystem.

The repo can then go about its business of synchronizing documents, but with the assurance that
every peer ID reported by the network has been authenticated, and that all traffic is also
authenticated and safe from eavesdropping.

### Authenticated sync server

For this to work with a sync server in a star-shaped network, the sync server needs to use the auth
provider as well. For that we have [@localfirst/auth-syncserver](../auth-syncserver/), a drop-in
replacement for the [Automerge Repo sync server](/automerge/automerge-repo-sync-server).

When using the auth provider with a sync server, provide the server's hostname when instantiating:

```ts
const authProvider = new AuthProvider({
  user,
  device,
  storage,
  server: 'localhost:3030',
})
```

If you use multiple sync servers, you can provide an array:

```ts
const authProvider = new AuthProvider({
  user,
  device,
  storage,
  server: ['sync1.example.com', 'sync2.example.com'],
})
```

Alternatively, you can add servers to an existing provider:

```ts
authProvider.addServer('sync3.example.com')
```

When you use the auth provider to create a team, it will automatically register the new team with the
server.

```ts
const team = authProvider.createTeam('team A')
```
