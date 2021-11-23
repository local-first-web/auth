import { CommandFn } from '..'

export const userName: CommandFn = subject => {
  const s = () => cy.wrap(subject)
  return s()
    .find('h1')
    .invoke('text')
}
