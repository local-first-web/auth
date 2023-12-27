import { test } from '@playwright/test'
import { newBrowser } from './helpers/basePage'
import { expect } from './helpers/expect'

test('creates a team', async ({ context }) => {
  const alice = await newBrowser(context)
  await alice.createTeam('alice', 'alice & friends')
  await alice.expect.toBeLoggedIn('alice')
})

test('can use the enter key to submit', async ({ context }) => {
  const alice = await newBrowser(context)
  await alice.enterFirstName('alice')
  await alice.pressEnter()

  // press "create a team"

  await alice.pressButton('Create')

  // provide team name
  await alice.enterTeamName('alice & friends')
  await alice.pressEnter()

  await alice.expect.toBeLoggedIn('alice')
})

test('team is persisted', async ({ context }) => {
  const alice = await newBrowser(context)
  await alice.createTeam('alice', 'alice & friends')
  await alice.expect.toBeLoggedIn('alice')

  await alice.reload()

  await alice.expect.toBeLoggedIn('alice')
})

test('logs in with an arbitrary name', async ({ context }) => {
  const alice = await newBrowser(context)
  await alice.createTeam('reginald', 'alice & friends')
  await alice.expect.toBeLoggedIn('reginald')
})

test('creates a member invitation', async ({ context }) => {
  const alice = await newBrowser(context)
  await alice.createTeam('alice', 'alice & friends')
  const invitationCode = await alice.createMemberInvitation()

  expect(invitationCode.length).toBeGreaterThan(50)
  expect(invitationCode).toContain('_')

  await alice.reload()
  await alice.expect.toBeLoggedIn('alice')
})

test('uses an invitation', async ({ context }) => {
  // This ensures that there's more than one team on the sync server
  const noise = await newBrowser(context)
  noise.createTeam('noise', `noise team`)

  const alice = await newBrowser(context)
  await alice.createTeam('alice', 'alice & friends')

  const invitationCode = await alice.createMemberInvitation()

  const bob = await newBrowser(context)
  await bob.joinAsMember('bob', invitationCode)

  await bob.expect.toBeLoggedIn('bob')
})
