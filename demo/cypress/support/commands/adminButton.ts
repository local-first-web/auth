import { NOLOG, wrap } from '../helpers'
import { type CommandFn } from '../types.js'

export const adminButton: CommandFn = (subject, userName: string) =>
  wrap(subject).teamMember(userName).findByText('👑', NOLOG)
