import { type CommandFn } from '../e2e.js'
import { NOLOG, wrap } from '../helpers'

export const promote: CommandFn = (subject, userName: string) =>
  wrap(subject).teamMember(userName).findByTitle('Click to make team admin', NOLOG).click(NOLOG)
