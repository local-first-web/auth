import { CommandFn } from '../'

export const promote: CommandFn = (subject, userName: string) =>
  cy
    .wrap(subject)
    .teamMember(userName)
    .findByTitle('Click to make team admin')
    .click()
