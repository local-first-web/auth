import { commandFn } from '..'

export const hide: commandFn = subject => {
  const s = () => cy.wrap(subject)
  return s()
    .find('.HideButton button')
    .click()
}
