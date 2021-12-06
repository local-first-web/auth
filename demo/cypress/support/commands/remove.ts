import { CommandFn } from '../types'

export const remove: CommandFn = (subject, userName: string) => {
  const s = () => cy.wrap(subject)
  return s()
    .teamMember(userName)
    .findByTitle('Remove member from team')
    .click()
}
