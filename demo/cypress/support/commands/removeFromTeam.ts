import { commandFn } from '..'

export const removeFromTeam: commandFn = (subject, userName: string) => {
  const s = () => cy.wrap(subject)
  s()
    .teamMember(userName)
    .findByText('✖')
    .click()
}
