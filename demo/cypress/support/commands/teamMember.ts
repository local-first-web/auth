import { NOLOG, wrap } from '../helpers'
import { type CommandFn } from '../types.js'

export const teamMember: CommandFn = (subject, userName: string) => {
  return wrap(subject).find('.MemberTable', NOLOG).findByText(userName, NOLOG).parents('tr', NOLOG)
}
