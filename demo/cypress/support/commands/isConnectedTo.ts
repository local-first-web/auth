import { CommandFn } from '..'

export const isConnectedTo: CommandFn = (subject, userName: string) => {
  cy.wrap(subject)
    .peerConnectionStatus(userName)
    .should('equal', 'connected')
}
