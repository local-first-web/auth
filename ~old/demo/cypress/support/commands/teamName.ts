import { commandFn } from '..'

export const teamName: commandFn = subject => {
  const s = () => cy.wrap(subject)
  return s().find('.TeamName').invoke('text')
}
