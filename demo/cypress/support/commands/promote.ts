import { commandFn } from '../'

export const promote: commandFn = (subject, userName: string) =>
  cy.wrap(subject).teamMember(userName).findByTitle('Click to make team admin').click()
