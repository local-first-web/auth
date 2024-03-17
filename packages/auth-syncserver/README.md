<img src="https://raw.githubusercontent.com/local-first-web/branding/main/svg/auth-h.svg"
width="300" alt="@localfirst/auth logo" />

## Authenticated sync server for Automerge Repo

This is a sync server that uses
[@localfirst/auth-provider-automerge-repo](../auth-provider-automerge-repo/) to authenticate
connections with peers.

This sync server works much the same way as the [automerge-repo sync
server](https://github.com/automerge/automerge-repo/blob/main/examples/sync-server/index.js), in
that is fundamentally just another peer running automerge-repo.

The sync server needs to be added to every team we want to sync with, and it needs to have a full
copy of the team graph. Instead of going through the invitation process, the sync server exposes an
REST API to obtain its public keys and to provide it with a team's graph.

### Instantiating a sync server

The server's hostname (without the port) is used as its unique identifier. Here we use `localhost`; in production this would look like `sync.my-organization.com`.

```ts
const host = 'localhost'
const port = 3030
const url = `${host}:${port}`
const storageDir = 'localfirst-auth-syncserver-storage'
const syncServer = new LocalFirstAuthSyncServer(host)
await syncServer.listen({ port, storageDir })
```

### Connecting to the sync server

A user creates an auth provider with a reference to the server's hostname, and instantiates a repo
as described [here](./auth-provider-automerge-repo/README.md).

```ts
// Instantiate a user's auth provider.
const user = Auth.createUser('alice')
const device = Auth.createDevice(user.userId, 'ALICE-MACBOOK-2023')
const storage = new SomeStorageAdapter()
const authProvider = new AuthProvider({
  user,
  device,
  storage,
  server: 'localhost:3030',
})

// Instantiate a repo.
const adapter = new SomeNetworkAdapter()
const network = [authProvider.wrap(adapter)]
const repo = new Repo({ network, storage })

// Create a team.
const team = await authProvider.createTeam(`Alice's team`)
```

A new team needs to be registered with the sync server using the API described below. The
`AuthProvider.createTeam()` method automatically does this for you. If you create the team outside
the auth provider, you can use the `AuthProvider.registerTeam()` method.

```ts
const team = Auth.createTeam('team A', aliceContext)
authProvider.addTeam(team)
await authProvider.registerTeam(team)
```

On the team, the server is treated more or less like a device with no user. The server **can't**
make any changes to the team's membership etc.; it can only relay changes made by team members. But
the server **can** verify invitations and admit new members and devices to the team.

Any number of servers can be registered with a team, and any number of teams can be registered with
a server.

The repo will now connect with the server, the auth provider will authenticate with it, and the repo
should get a `peer` event.

```ts
repo.networkSubsystem.on('peer', ({ peerId }) => {
  console.log(peerId) // `localhost` or `sync.my-organization.com`
})
```

From this point on, our communication with the sync server takes place over an encrypted channel.
All subsequent changes to the team (inviting or removing members, etc.) will be automatically synced
with the server.

### Server API

The sync server exposes two endpoints that are used when adding a new team.

(You wouldn't normally access this API yourself; the `AuthProvider.createTeam()` and
`AuthProvider.registerTeam()` methods call these endpoints for you.)

#### GET `/keys`

Obtains the server's public keys. We need these to add the server to the team.

```ts
const response = await fetch(`http://${url}/keys`)
const keys = await response.json()

// Use these keys to add the server to the team
team.addServer({ host, keys })
```

#### POST `/teams`

Registers the team with the sync server by giving it a complete copy of the team's data.

```ts
await fetch(`http://${url}/teams`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serializedGraph: team.save(), // the serialized team is encrypted
    teamKeyring: team.teamKeyring(), // these are needed to decrypt the serialized team
  }),
})
```
