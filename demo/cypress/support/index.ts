// register commands

import '@testing-library/cypress/add-commands'
import * as _commands from './commands'
const commands = _commands as { [key: string]: CommandFn }

for (const key in commands) {
  const command = commands[key] as CommandFn
  Cypress.Commands.add(key, { prevSubject: true }, command)
}

declare global {
  namespace Cypress {
    interface Chainable extends CustomCommands {}
  }
}

export type CommandKey = keyof Cypress.Chainable<any>
export type CommandFn = (...args: any[]) => Cypress.Chainable
export type CustomCommands = typeof commands

// register assertions

import './assertions/be.admin'
import './assertions/be.online'
import './assertions/have.member'

declare global {
  namespace Cypress {
    interface Chainer<Subject> {
      (chainer: 'be.admin'): Chainable<Subject>
      (chainer: 'not.be.admin'): Chainable<Subject>
      (chainer: 'be.online'): Chainable<Subject>
      (chainer: 'not.be.online'): Chainable<Subject>
    }
  }
}

// utilities

export const show = (id: string) => cy.get('.Chooser select').select(id)

export const peer = (userName: string, deviceName: string = 'laptop') =>
  cy.root().findByTitle(`${userName}:${deviceName}`)

export const alice = () => peer('Alice')
export const bob = () => peer('Bob')
export const charlie = () => peer('Charlie')
export const alicePhone = () => peer('Alice', 'phone')
export const bobPhone = () => peer('bob', 'phone')
export const charliePhone = () => peer('charlie', 'phone')
export const eve = () => peer('Eve')
export const evePhone = () => peer('Eve', 'phone')

export const aliceToAlice = () => alice().teamMember('Alice')
export const aliceToBob = () => bob().teamMember('Alice')
export const bobToAlice = () => alice().teamMember('Bob')
export const bobToBob = () => bob().teamMember('Bob')
