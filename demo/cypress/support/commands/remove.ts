import { CommandFn } from '../types.js'

export const remove: CommandFn = (subject, userName: string) => {
  const s = () => cy.wrap(subject)
  return s()
    .teamMember(userName)
    .findByTitle('Remove member from team')
    .click()
}
