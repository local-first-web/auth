import { NOLOG, wrap } from '../helpers'
import { type CommandFn } from '../types.js'

export const remove: CommandFn = (subject, userName: string) => {
  const s = () => wrap(subject)
  return s().teamMember(userName).findByTitle('Remove member from team', NOLOG).click(NOLOG)
}
