import { pause } from '@localfirst/auth-shared'
import { type BrowserContext, type ConsoleMessage, type Page } from '@playwright/test'
import { expect } from '../helpers/expect'

export const newBrowser = async (context: BrowserContext) => {
  const browser = await context.browser()!.newContext()
  const page = await browser.newPage()
  return new BasePage(page).start()
}

export class BasePage {
  userName?: string
  teamName?: string

  constructor(readonly page: Page) {
    this.page = page
  }

  // GENERAL

  log(msg: ConsoleMessage) {
    const text: string = msg.text().replace(/(color: #([0-9A-F]{6}))|(color: inherit)|%c/g, '')
    console.log(text)
  }

  async start() {
    await this.page.goto('/')

    const debug = process.env.DEBUG
    if (debug) {
      // feed browser logs to test output
      this.page.on('console', msg => this.log(msg))

      // enable debug logging
      await this.page.evaluate(`window.localStorage.setItem('debug', '${debug}')`)
      // reload so these take effect
      await pause(500)
      await this.page.reload()
    }
    return this
  }

  async reload() {
    await pause(100) // give storage etc. time to finish
    await this.page.reload()
    return this
  }

  get expect() {
    return expect(this.page)
  }

  async pressButton(name?: string) {
    await this.page.getByRole('button', { name }).click()
  }

  async pressEnter() {
    await this.page.keyboard.press('Enter')
  }

  async enterFirstName(firstName: string) {
    await this.page.getByLabel('first name').fill(firstName)
    this.userName = firstName
  }

  async enterTeamName(teamName: string) {
    await this.page.getByLabel('name for your team').fill(teamName)
    this.teamName = teamName
  }

  async getClipboard() {
    return this.page.evaluate<string>('navigator.clipboard.readText()')
  }

  // AUTH

  async createTeam(userName: string, teamName: string) {
    // provide first name
    await this.enterFirstName(userName)
    await this.pressButton('Continue')

    // press "create a team"
    await this.pressButton('Create')

    // provide team name
    await this.enterTeamName(teamName)
    await this.pressButton()
    await this.page.getByRole('button', { name: 'Clear completed' }).isVisible()
  }

  async createMemberInvitation() {
    await this.pressButton('Invite members')
    await this.pressButton('Invite')
    await this.pressButton('Copy')
    await this.page.keyboard.press('Escape')
    const invitationCode: string = await this.getClipboard()
    return invitationCode
  }

  async joinAsMember(userName: string, invitationCode: string) {
    await this.enterFirstName(userName)
    await this.pressButton()

    await this.pressButton('Join')

    await this.page.getByLabel('Invitation code').fill(invitationCode)
    await this.pressButton('Join')
  }

  todos(index?: number) {
    const todos = this.page.locator('ul > li').getByRole('textbox')
    return index === undefined ? todos : todos.nth(index)
  }

  async addTodo(text: string) {
    const newTodo = this.page.getByPlaceholder('Add a new todo')
    await newTodo.fill(text)
    await newTodo.press('Enter')
  }

  async toggleTodo(index: number) {
    await this.page.getByRole('checkbox').nth(index).click()
  }
}
