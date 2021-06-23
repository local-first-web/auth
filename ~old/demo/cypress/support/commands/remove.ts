import { commandFn } from '..'

export const remove: commandFn = (subject, userName: string) => {
  const s = () => cy.wrap(subject)
  s()
    .teamMember(userName)
    .findByTitle('Remove member from team')
    .click()
}
