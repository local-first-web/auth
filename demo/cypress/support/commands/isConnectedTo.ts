import { CommandFn } from '../types'

export const isConnectedTo: CommandFn = (subject, userName: string) =>
  cy
    .wrap(subject)
    .peerConnectionStatus(userName)
    .should('equal', 'connected')
