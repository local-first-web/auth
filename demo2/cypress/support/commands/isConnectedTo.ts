import { commandFn } from '..'

export const isConnectedTo: commandFn = (subject, userName: string) => {
  cy.wrap(subject)
    .peerConnectionStatus(userName)
    .should('equal', 'connected')
}
