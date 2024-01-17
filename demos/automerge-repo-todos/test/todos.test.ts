import { BrowserContext, expect, test } from '@playwright/test'
import { newBrowser } from './helpers/App'

const TODOS = ['buy some cheese', 'feed the cat', 'book a doctors appointment']

const setup = async (context: BrowserContext) => {
  const alice = await newBrowser(context)
  await alice.createTeam('Alice', 'Alice & friends')
  await alice.expect.toBeLoggedIn('Alice')
  // Alice invites Bob
  const invitationCode = await alice.createMemberInvitation()

  // Bob joins
  const bob = await newBrowser(context)
  await bob.joinAsMember('Bob', invitationCode)
  await bob.expect.toBeLoggedIn('Bob')

  // Alice and Bob add one todo each
  await alice.addTodo(TODOS[0])
  await bob.addTodo(TODOS[1])

  return { alice, bob }
}

test('syncs todos between two members', async ({ context }) => {
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

test('syncs todos between two devices', async ({ context }) => {
  const laptop = await newBrowser(context)
  await laptop.createTeam('Alice', 'Alice & friends')
  await laptop.expect.toBeLoggedIn('Alice')

  // Alice creates a device invitation
  const invitationCode = await laptop.createDeviceInvitation()

  // She enters the code on her phone
  const phone = await newBrowser(context)
  await phone.joinAsDevice('Alice', invitationCode)
  await phone.expect.toBeLoggedIn('Alice')

  // each device adds a todo
  await laptop.addTodo(TODOS[0])
  await phone.addTodo(TODOS[1])

  // the laptop sees both todos
  await expect(laptop.todos()).toHaveCount(2)
  await expect(laptop.todos(0)).toHaveValue(TODOS[0])
  await expect(laptop.todos(1)).toHaveValue(TODOS[1])

  // the phone sees both todos
  await expect(phone.todos()).toHaveCount(2)
  await expect(phone.todos(0)).toHaveValue(TODOS[0])
  await expect(phone.todos(1)).toHaveValue(TODOS[1])
})
