import { CommandFn } from './types'

export const NOLOG = { log: false }

export const wrapCommand =
  (key: string, fn: (...args: any[]) => Cypress.Chainable) =>
  (...args: any[]) => {
    // Turn off logging of the cy.window() to command log
    const displayArgs = args.map(arg =>
      arg && typeof arg === 'object' && 'selector' in arg ? arg.selector : arg.toString()
    )
    const name = `${key} ${displayArgs.join(' ')}`
    Cypress.log({
      name,
      displayName: key,
      message: displayArgs.join(' '),
      consoleProps: () => {
        return {
          args: displayArgs,
        }
      },
    })

    return fn(...args)
  }

export const show = wrapCommand('show', (id: string) =>
  cy.get('.Chooser select', NOLOG).select(id, NOLOG)
)

export const peer = wrapCommand('peer', (userName: string, deviceName = 'laptop') =>
  cy.root(NOLOG).findByTitle(`${userName}:${deviceName}`, NOLOG)
)

export const alice = () => peer('Alice')
export const bob = () => peer('Bob')
export const charlie = () => peer('Charlie')
export const dwight = () => peer('Dwight')

export const alicePhone = () => peer('Alice', 'phone')
export const bobPhone = () => peer('bob', 'phone')
export const charliePhone = () => peer('charlie', 'phone')
export const eve = () => peer('Eve')
export const evePhone = () => peer('Eve', 'phone')

export const aliceToAlice = wrapCommand('aliceToAlice', () => alice().teamMember('Alice'))
export const aliceToBob = wrapCommand('aliceToBob', () => bob().teamMember('Alice'))
export const aliceToCharlie = wrapCommand('aliceToCharlie', () => charlie().teamMember('Alice'))

export const bobToAlice = wrapCommand('bobToAlice', () => alice().teamMember('Bob'))
export const bobToBob = wrapCommand('bobToBob', () => bob().teamMember('Bob'))
export const bobToCharlie = wrapCommand('bobToCharlie', () => charlie().teamMember('Bob'))

export const charlieToAlice = wrapCommand('charlieToAlice', () => alice().teamMember('Charlie'))
export const charlieToBob = wrapCommand('charlieToBob', () => bob().teamMember('Charlie'))
export const charlieToCharlie = wrapCommand('charlieToCharlie', () =>
  charlie().teamMember('Charlie')
)

export const wrap: CommandFn = subject => cy.wrap(subject, NOLOG)
