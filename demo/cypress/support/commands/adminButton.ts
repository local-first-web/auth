import { type CommandFn } from '../types'

export const adminButton: CommandFn = (subject, userName: string) =>
  cy.wrap(subject).teamMember(userName).findByText('👑')
