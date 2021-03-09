import '@testing-library/cypress/add-commands'
import { addToTeam } from './commands/addToTeam'
import { adminButton } from './commands/adminButton'
import { connectionStatus } from './commands/connectionStatus'
import { demote } from './commands/demote'
import { invite } from './commands/invite'
import { join } from './commands/join'
import { promote } from './commands/promote'
import { remove } from './commands/remove'
import { teamMember } from './commands/teamMember'
import { teamName } from './commands/teamName'
import { userName } from './commands/userName'

import './assertions/admin'

Cypress.Commands.add('addToTeam', { prevSubject: true }, addToTeam)
Cypress.Commands.add('adminButton', { prevSubject: true }, adminButton)
Cypress.Commands.add('connectionStatus', { prevSubject: true }, connectionStatus)
Cypress.Commands.add('demote', { prevSubject: true }, demote)
Cypress.Commands.add('userName', { prevSubject: true }, userName)
Cypress.Commands.add('invite', { prevSubject: true }, invite)
Cypress.Commands.add('join', { prevSubject: true }, join)
Cypress.Commands.add('promote', { prevSubject: true }, promote)
Cypress.Commands.add('remove', { prevSubject: true }, remove)
Cypress.Commands.add('teamMember', { prevSubject: true }, teamMember)
Cypress.Commands.add('teamName', { prevSubject: true }, teamName)

declare global {
  namespace Cypress {
    interface Chainer<Subject> {
      (chainer: 'be.admin'): Chainable<Subject>
      (chainer: 'not.be.admin'): Chainable<Subject>
    }
    interface Chainable {
      addToTeam(userName: string): Chainable<Element>
      adminButton(userName: string): Chainable<Element>
      connectionStatus(userName: string): Chainable<string>
      demote(userName: string): Chainable<Element>
      invite(userName: string): Chainable<string>
      join(code: string): Chainable<Element>
      promote(userName: string): Chainable<Element>
      remove(): Chainable<Element>
      teamMember(userName: string): Chainable<Element>
      teamName(): Chainable<string>
      userName(): Chainable<string>
    }
  }
}

export type commandFn = (...args: any[]) => void | Cypress.Chainable | Promise<unknown>

export const add = (id: string) => cy.get('.Chooser select').select(id)
export const peer = (name: string) => cy.get('h1').contains(name).parents('.Peer')
export const alice = () => peer('Alice')
export const bob = () => peer('Bob')
