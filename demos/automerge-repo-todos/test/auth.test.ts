import { test } from '@playwright/test'
import { newBrowser } from './helpers/basePage'
import { expect } from './helpers/expect'

const userName = 'herb'
const teamName = 'DevResults'

test.describe('Create team', () => {
  test('creates a team', async ({ context }) => {
    const app = await newBrowser(context)
    await app.createTeam(userName, teamName)
    await app.expect.toBeLoggedIn()
  })

  test('can use the enter key to submit', async ({ context }) => {
    const app = await newBrowser(context)
    await app.enterFirstName(userName)
    await app.pressEnter()

    // press "create a team"

    await app.pressButton('Create')

    // provide team name
    await app.enterTeamName(teamName)
    await app.pressEnter()

    await app.expect.toBeLoggedIn()
  })

  test('team is persisted', async ({ context }) => {
    const app = await newBrowser(context)
    await app.createTeam(userName, teamName)
    await app.expect.toBeLoggedIn()

    await app.reload()

    await app.expect.toBeLoggedIn()
  })

  test('logs in with an arbitrary name', async ({ context }) => {
    const app = await newBrowser(context)
    await app.createTeam('reginald', teamName)
    await app.expect.toBeLoggedIn('reginald')
  })
})

test.describe('Invitations', () => {
  test('creates a member invitation', async ({ context }) => {
    const alice = await newBrowser(context)
    await alice.createTeam('alice', teamName)
    const invitationCode = await alice.createMemberInvitation()

    expect(invitationCode.length).toBeGreaterThan(50)
    expect(invitationCode).toContain('_')

    await alice.reload()
    await alice.expect.toBeLoggedIn('alice')
  })

  test('uses an invitation', async ({ context }) => {
    // This noise causes the test to fail intermittently when run in isolation
    const noise = await newBrowser(context)
    noise.createTeam('noise', `noise team`)

    const alice = await newBrowser(context)
    await alice.createTeam('alice', teamName)

    const invitationCode = await alice.createMemberInvitation()

    const bob = await newBrowser(context)
    await bob.joinAsMember('bob', invitationCode)

    await bob.expect.toBeLoggedIn('bob')
  })
})
