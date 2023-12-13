import { type CommandFn } from '../types.js'

export const adminButton: CommandFn = (subject, userName: string) =>
  cy.wrap(subject).teamMember(userName).findByText('👑')
