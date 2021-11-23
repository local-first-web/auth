import { CommandFn } from '../'

export const demote: CommandFn = (subject, userName: string) =>
  cy
    .wrap(subject)
    .teamMember(userName)
    .findByTitle('Team admin (click to remove)')
    .click()
