import { createTeam, device, loadTeam } from '@localfirst/auth'
import { type ShareId } from '@localfirst/auth-provider-automerge-repo'
import { eventPromise } from '@localfirst/auth-shared'
import { expect, it } from 'vitest'
import { host, setup } from './helpers/setup.js'

it('should start a server', async () => {
  const { url } = await setup()
  const response = await fetch(`http://${url}`)
  const text = await response.text()

  // the server responds with a string like "Sync server is running"
  expect(text).toContain('running')
})

it("should return the server's public keys", async () => {
  const { url, server } = await setup()
  const response = await fetch(`http://${url}/keys`)
  const keys = await response.json()

  // the keys look like keys
  expect(lookLikeServerKeys(keys)).toBe(true)

  // they match the server's public keys
  expect(server.publicKeys).toEqual(keys)
})

it.only('Alice can create a team', async () => {
  const { users } = await setup(['alice'])
  const { alice } = users

  await alice.authProvider.createTeam('team A')

  // when we're authenticated, we get a peer event
  const { peerId } = await eventPromise(alice.repo.networkSubsystem, 'peer')
  expect(peerId).toEqual(host)
})

it(`Eve can't replace the team on the sync server`, async () => {
  const { users, url } = await setup(['alice', 'eve'])
  const { alice } = users

  // Alice creates a team and registers it with the server
  const team = createTeam('team A', { user: alice.user, device: alice.device })
  await alice.authProvider.addTeam(team)

  const keysResponse = await fetch(`http://${url}/keys`)
  const keys = await keysResponse.json()

  team.addServer({ host, keys })

  const serializedGraph = team.save()
  const teamKeyring = team.teamKeyring()

  await fetch(`http://${url}/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serializedGraph, teamKeyring }),
  })

  const { peerId } = await eventPromise(alice.repo.networkSubsystem, 'peer')
  expect(peerId).toEqual(host)

  // Eve tries to re-register the team with the server

  // The server's policy is to reject a team registration if the team already exists. We're
  // providing the same serialized graph that Alice provided, but imagine that Eve has somehow
  // modified it to have the same id but to give herself admin privileges. (In reality Eve can't
  // tamper with the team graph in this way - the team ID is the team's root hash, and every link
  // in the graph is signed and hashed, so Eve can't modify the it without invalidating it
  // - but this adds an extra layer of security.)

  const response = await fetch(`http://${url}/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serializedGraph, teamKeyring }),
  })
  expect(response.status).toBe(500)
  expect(await response.text()).toContain('already registered')
})

it('Alice and Bob can communicate', async () => {
  const { users } = await setup(['alice', 'bob'])
  const { alice, bob } = users

  // Alice creates a team
  const aliceTeam = await alice.authProvider.createTeam('team A')

  // Alice puts Bob on her team
  aliceTeam.addForTesting(bob.user, [], device.redactDevice(bob.device))

  // Alice authenticates
  await eventPromise(alice.repo.networkSubsystem, 'peer')

  // Give Bob a copy of the team
  const bobTeam = loadTeam(
    aliceTeam.graph,
    { user: bob.user, device: bob.device },
    aliceTeam.teamKeyring()
  )
  await bob.authProvider.addTeam(bobTeam)

  // Bob authenticates
  await eventPromise(bob.repo.networkSubsystem, 'peer')

  // Bob should see Alice's change
  aliceTeam.addRole('MANAGERS')

  // Wait for Bob's team to get updated so we can check that both teams are in sync
  await eventPromise(bobTeam, 'updated')

  expect(bobTeam.hasRole('MANAGERS')).toBe(true)
})

it('Alice and Bob can communicate over a public share', async () => {
  const { users } = await setup(['alice', 'bob'])
  const { alice, bob } = users

  const shareId = 'public-todo-app' as ShareId

  await Promise.all([
    // Alice creates a public share
    alice.authProvider.createPublicShare(shareId),

    // She tells Bob about it
    bob.authProvider.joinPublicShare(shareId),

    // Alice and Bob establish an unauthenticated connection
    eventPromise(alice.repo.networkSubsystem, 'peer'),
  ])

  // Alice creates a new document
  const aliceDocHandle = alice.repo.create<TestDoc>()
  aliceDocHandle.change(doc => {
    doc.foo = 'alice'
  })

  // Bob gets the document
  const bobDocHandle = bob.repo.find<TestDoc>(aliceDocHandle.url)
  await eventPromise(bobDocHandle, 'change')
  expect(bobDocHandle.docSync()).toStrictEqual({ foo: 'alice' })

  // Note: Without any kind of authorization control, adding a public share to an auth
  // provider is equivalent to just using the adapter without an auth provider. Every document
  // that is added to the repo will now be available to anyone who knows the shareId.
  // The next step would be to wire up the repo's `sharePolicy` to an authorization provider
  // that lets us e.g. add specific documents to a share.
})

const lookLikeServerKeys = (maybeKeyset: any) =>
  maybeKeyset.generation === 0 &&
  typeof maybeKeyset.encryption === 'string' &&
  typeof maybeKeyset.signature === 'string'

type TestDoc = {
  foo: string
}
