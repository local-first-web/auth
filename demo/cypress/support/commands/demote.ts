import { NOLOG, wrap } from '../helpers'
import { type CommandFn } from '../types.js'

export const demote: CommandFn = (subject, userName: string) =>
  wrap(subject).teamMember(userName).findByTitle('Team admin (click to remove)', NOLOG).click(NOLOG)
