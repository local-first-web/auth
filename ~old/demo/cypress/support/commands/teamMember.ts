import { commandFn } from '..'

export const teamMember: commandFn = (subject, userName: string) => {
  return cy.wrap(subject).find('.MemberTable').findByText(userName).parents('tr')
}
