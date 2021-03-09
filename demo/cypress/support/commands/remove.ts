import { commandFn } from '..'

export const remove: commandFn = subject => {
  const s = () => cy.wrap(subject)
  return s().find('.RemoveButton button').click()
}
