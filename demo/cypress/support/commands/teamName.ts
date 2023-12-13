import { NOLOG, wrap } from '../helpers'
import { type CommandFn } from '../types.js'

export const teamName: CommandFn = subject => {
  const s = () => wrap(subject)
  return s().find('.TeamName', NOLOG).invoke(NOLOG, 'text')
}
