import { CommandFn } from '../types'

export const teamName: CommandFn = subject => {
  const s = () => cy.wrap(subject)
  return s()
    .find('.TeamName')
    .invoke('text')
}
