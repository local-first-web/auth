import { commandFn } from '..'

export const adminButton: commandFn = (subject, userName: string) =>
  cy.wrap(subject).teamMember(userName).findByText('👑')
