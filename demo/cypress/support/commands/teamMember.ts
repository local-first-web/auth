import { CommandFn } from '..'

export const teamMember: CommandFn = (subject, userName: string) => {
  return cy
    .wrap(subject)
    .find('.MemberTable')
    .findByText(userName)
    .parents('tr')
}
