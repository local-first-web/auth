// register commands

import '@testing-library/cypress/add-commands'
import * as _commands from './commands/index.js'

// register assertions

import './assertions/be.admin.js'
import './assertions/be.online.js'
import './assertions/have.member.js'
import './assertions/be.onStartScreen.js'

import { type CommandFn } from './types.js'
import { wrapCommand } from './helpers'
export { type CommandFn } from './types.js'

const commands = _commands as Record<string, CommandFn>

for (const key in commands) {
  const command = commands[key]
  Cypress.Commands.add(key, { prevSubject: true }, wrapCommand(key, command))
}

declare global {
  namespace Cypress {
    interface Chainable extends CustomCommands {}
  }
}

export type CustomCommands = typeof commands

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

beforeEach(() => {
  cy.visit('/')
  localStorage.setItem('debug', 'lf:*')
})
