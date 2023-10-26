import { type CommandFn } from '../types'

export const toggleOnline: CommandFn = subject => {
  const s = () => cy.wrap(subject)
  return s()
    .find('.OnlineToggle')
    .invoke('attr', 'title')
    .then(prevState => {
      s().find('.OnlineToggle').click().invoke('attr', 'title').should('not.equal', prevState)
    })
    .then(() => subject)
}
