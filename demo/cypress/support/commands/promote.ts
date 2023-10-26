import { type CommandFn } from '../e2e.js'

export const promote: CommandFn = (subject, userName: string) =>
  cy.wrap(subject).teamMember(userName).findByTitle('Click to make team admin').click()
