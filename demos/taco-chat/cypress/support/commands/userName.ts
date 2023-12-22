import { NOLOG, wrap } from '../helpers'
import { type CommandFn } from '../types.js'

export const userName: CommandFn = subject => {
  const s = () => wrap(subject)
  return s().find('h1', NOLOG).invoke(NOLOG, 'text')
}
