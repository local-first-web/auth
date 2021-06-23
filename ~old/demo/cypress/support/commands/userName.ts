import { commandFn } from '..'

export const userName: commandFn = subject => {
  const s = () => cy.wrap(subject)
  return s().find('h1').invoke('text')
}
