import { CommandFn } from '..'

export const remove: CommandFn = (subject, userName: string) => {
  const s = () => cy.wrap(subject)
  s()
    .teamMember(userName)
    .findByTitle('Remove member from team')
    .click()
}
