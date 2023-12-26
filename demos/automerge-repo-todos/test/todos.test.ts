import { BrowserContext, test } from '@playwright/test'
import { newBrowser } from './helpers/basePage'
import { expect } from './helpers/expect'

const TODOS = ['buy some cheese', 'feed the cat', 'book a doctors appointment']

test.describe('Todos', () => {
  const setup = async (context: BrowserContext) => {
    const alice = await newBrowser(context)
    await alice.createTeam('alice', 'alice & friends')
    await alice.expect.toBeLoggedIn('alice')
    // Alice invites Bob
    const invitationCode = await alice.createMemberInvitation()

    // Bob joins
    const bob = await newBrowser(context)
    await bob.joinAsMember('bob', invitationCode)
    await bob.expect.toBeLoggedIn('bob')

    // Alice and Bob add one todo each
    await alice.addTodo(TODOS[0])
    await bob.addTodo(TODOS[1])

    return { alice, bob }
  }

  test('syncs todos', async ({ context }) => {
    const { alice, bob } = await setup(context)
    // Alice sees both todos
    await expect(alice.todos()).toHaveCount(2)
    await expect(alice.todos(0)).toHaveValue(TODOS[0])
    await expect(alice.todos(1)).toHaveValue(TODOS[1])

    // Bob sees both todos
    await expect(bob.todos()).toHaveCount(2)
    await expect(bob.todos(0)).toHaveValue(TODOS[0])
    await expect(bob.todos(1)).toHaveValue(TODOS[1])
  })

  test('syncs checked state', async ({ context }) => {
    const { alice, bob } = await setup(context)

    // Alice checks the first todo
    await alice.toggleTodo(0)

    // Alice sees the first todo checked
    await expect(alice.page.getByRole('checkbox').nth(0)).toBeChecked()
    await expect(alice.page.getByRole('checkbox').nth(1)).not.toBeChecked()

    // Bob sees the first todo checked
    await expect(bob.page.getByRole('checkbox').nth(0)).toBeChecked()
    await expect(bob.page.getByRole('checkbox').nth(1)).not.toBeChecked()

    // Bob checks the second todo
    await bob.toggleTodo(1)

    // Alice sees the second todo checked
    await expect(alice.page.getByRole('checkbox').nth(0)).toBeChecked()
    await expect(alice.page.getByRole('checkbox').nth(1)).toBeChecked()

    // Bob sees the second todo checked
    await expect(bob.page.getByRole('checkbox').nth(0)).toBeChecked()
    await expect(bob.page.getByRole('checkbox').nth(1)).toBeChecked()

    // Alice unchecks the first todo
    await alice.toggleTodo(0)

    // Alice sees the first todo unchecked
    await expect(alice.page.getByRole('checkbox').nth(0)).not.toBeChecked()
    await expect(alice.page.getByRole('checkbox').nth(1)).toBeChecked()

    // Bob sees the first todo unchecked
    await expect(bob.page.getByRole('checkbox').nth(0)).not.toBeChecked()
    await expect(bob.page.getByRole('checkbox').nth(1)).toBeChecked()
  })
})
