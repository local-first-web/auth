<img src="https://raw.githubusercontent.com/local-first-web/branding/main/svg/auth-h.svg"
width="300" alt="@localfirst/auth logo" />

## Authenticated sync server for Automerge Repo

```ts
// Instantiate the server.

// The server's hostname is used as its unique identifier.
const host = 'localhost' // in prod this would look like 'sync.my-organization.com'
const port = 3030
const url = `${host}:${port}`
const storageDir = 'localfirst-auth-syncserver-storage'
const server = new LocalFirstAuthSyncServer(host)
await server.listen({ port, storageDir })

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

// Get the server's public keys.
const response = await fetch(`http://${url}/keys`)
const keys = await response.json()

// Register the server's public keys to the team.
team.addServer({ host, keys })

// Provide the server with a complete copy of the team
await fetch(`http://${url}/teams`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    serializedGraph: team.save(), // the serialized team is encrypted
    teamKeyring: team.teamKeyring(), // these are needed to decrypt the serialized team
  }),
})

// The auth provider will now authenticate with the sync server, and the repo should get a `peer` event.
repo.networkSubsystem.on("peer", ({peerId}) => {
  console.log(peerId) // `localhost` or `sync.my-organization.com`
}
```
