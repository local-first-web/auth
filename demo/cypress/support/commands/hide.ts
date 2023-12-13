import { NOLOG, wrap } from '../helpers'
import { type CommandFn } from '../types.js'

export const hide: CommandFn = subject => {
  const s = () => wrap(subject)
  return s().find('.HideButton button', NOLOG).click(NOLOG)
}
