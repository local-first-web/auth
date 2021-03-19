import '@testing-library/cypress/add-commands'

import './assertions/admin'
import './assertions/online'

import { addToTeam } from './commands/addToTeam'
import { adminButton } from './commands/adminButton'
import { demote } from './commands/demote'
import { invite } from './commands/invite'
import { isConnectedTo } from './commands/isConnectedTo'
import { join } from './commands/join'
import { peerConnectionStatus } from './commands/peerConnectionStatus'
import { promote } from './commands/promote'
import { remove } from './commands/remove'
import { teamMember } from './commands/teamMember'
import { teamName } from './commands/teamName'
import { toggleOnline } from './commands/toggleOnline'
import { userName } from './commands/userName'

Cypress.Commands.add('addToTeam', { prevSubject: true }, addToTeam)
Cypress.Commands.add('adminButton', { prevSubject: true }, adminButton)
Cypress.Commands.add('demote', { prevSubject: true }, demote)
Cypress.Commands.add('invite', { prevSubject: true }, invite)
Cypress.Commands.add('isConnectedTo', { prevSubject: true }, isConnectedTo)
Cypress.Commands.add('join', { prevSubject: true }, join)
Cypress.Commands.add('peerConnectionStatus', { prevSubject: true }, peerConnectionStatus)
Cypress.Commands.add('promote', { prevSubject: true }, promote)
Cypress.Commands.add('remove', { prevSubject: true }, remove)
Cypress.Commands.add('teamMember', { prevSubject: true }, teamMember)
Cypress.Commands.add('teamName', { prevSubject: true }, teamName)
Cypress.Commands.add('toggleOnline', { prevSubject: true }, toggleOnline)
Cypress.Commands.add('userName', { prevSubject: true }, userName)

declare global {
  namespace Cypress {
    interface Chainer<Subject> {
      (chainer: 'be.admin'): Chainable<Subject>
      (chainer: 'not.be.admin'): Chainable<Subject>
      (chainer: 'be.online'): Chainable<Subject>
      (chainer: 'not.be.online'): Chainable<Subject>
    }
    interface Chainable {
      addToTeam(userName: string): Chainable<Element>
      adminButton(userName: string): Chainable<Element>
      demote(userName: string): Chainable<Element>
      invite(userName: string): Chainable<string>
      isConnectedTo(userName: string): Chainable<string>
      join(code: string): Chainable<Element>
      peerConnectionStatus(userName: string): Chainable<string>
      promote(userName: string): Chainable<Element>
      remove(): Chainable<Element>
      teamMember(userName: string): Chainable<Element>
      teamName(): Chainable<string>
      toggleOnline(): Chainable<string>
      userName(): Chainable<string>
    }
  }
}

export type commandFn = (...args: any[]) => void | Cypress.Chainable | Promise<unknown>

export const add = (id: string) => cy.get('.Chooser select').select(id)
export const peer = (name: string) =>
  cy
    .get('h1')
    .contains(name)
    .parents('.Peer')

export const alice = () => peer('Alice')
export const bob = () => peer('Bob')
export const charlie = () => peer('Charlie')
