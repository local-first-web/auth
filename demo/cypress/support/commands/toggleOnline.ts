import { NOLOG, wrap } from '../helpers'
import { type CommandFn } from '../types.js'

export const toggleOnline: CommandFn = subject => {
  const s = () => wrap(subject)
  return s()
    .find('.OnlineToggle', NOLOG)
    .invoke(NOLOG, 'attr', 'title')
    .then(prevState => {
      s()
        .find('.OnlineToggle', NOLOG)
        .click(NOLOG)
        .invoke(NOLOG, 'attr', 'title')
        .should('not.equal', prevState)
    })
    .then(() => subject)
}
