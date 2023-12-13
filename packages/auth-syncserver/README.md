<img src="https://raw.githubusercontent.com/local-first-web/branding/main/svg/auth-h.svg"
width="300" alt="@localfirst/auth logo" />

## Authenticated sync server for Automerge Repo

This is a sync server that uses [@localfirst/auth-provider-automerge-repo](../auth-provider-automerge-repo/)
to authenticate connections with peers.

### Instantiating a sync server

The server's hostname is used as its unique identifier. Here we use `localhost`; in production this would look like `sync.my-organization.com`.

```ts
const host = 'localhost'
const port = 3030
const url = `${host}:${port}`
const storageDir = 'localfirst-auth-syncserver-storage'
const server = new LocalFirstAuthSyncServer(host)
await server.listen({ port, storageDir })
```

A user creates an auth provider and instantiates a repo as described [here](./auth-provider-automerge-repo/README.md).

```ts
// Instantiate a user's auth provider.
const user = Auth.createUser('alice')
const device = Auth.createDevice(user.userId, `ALICE-MACBOOK-2023`)
const storage = new SomeStorageAdapter()
const authProvider = new AuthProvider({ user, device, storage })

// Instantiate a repo.
const adapter = new SomeNetworkAdapter()
const network = [authProvider.wrap(adapter)]
const repo = new Repo({ network, storage })

// Create a team.
const team = createTeam(`Alice's cool team`, { user, device })
await alice.authProvider.addTeam(team)
```

### Registering the sync server with the team

First, we ask the server for its public keys.

```ts
const response = await fetch(`http://${url}/keys`)
const keys = await response.json()
```

Then we register the server with the team.

```ts
team.addServer({ host, keys })
```

On the team, the server is treated more or less like a device with no user. The server can't make
any changes to the team's membership etc.; it can only relay changes made by team members.

But the server can verify invitations and admit new members and devices to the team.

Any number of servers can be registered with a team.

### Registering the team with the sync server

Next, we give the server a complete copy of the team's data.

```ts
// Provide the server with a complete copy of the team
await fetch(`http://${url}/teams`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serializedGraph: team.save(), // the serialized team is encrypted
    teamKeyring: team.teamKeyring(), // these are needed to decrypt the serialized team
  }),
})
```

Any number of teams can be registered with a server.

### Connecting to the sync server

The repo will now connect with the server, the auth provider will authenticate with it, and the repo
should get a `peer` event.

```ts
repo.networkSubsystem.on("peer", ({peerId}) => {
  console.log(peerId) // `localhost` or `sync.my-organization.com`
}
```

From this point on, our communication with the sync server takes place over an encrypted channel. All
subsequent changes to the team (inviting or removing members, etc.) will be automatically synced
with the server.
