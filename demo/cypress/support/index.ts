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

export type CustomCommands = typeof commands

// register assertions

import './assertions/be.admin'
import './assertions/be.online'
import './assertions/have.member'
import './assertions/be.onStartScreen'

import { CommandFn } from './types'

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
