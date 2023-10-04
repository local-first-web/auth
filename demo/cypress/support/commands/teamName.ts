import { CommandFn } from '../types.js'

export const teamName: CommandFn = subject => {
  const s = () => cy.wrap(subject)
  return s()
    .find('.TeamName')
    .invoke('text')
}
