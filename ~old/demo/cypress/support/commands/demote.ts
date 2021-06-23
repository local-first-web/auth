import { commandFn } from '../'

export const demote: commandFn = (subject, userName: string) =>
  cy.wrap(subject).teamMember(userName).findByTitle('Team admin (click to remove)').click()
