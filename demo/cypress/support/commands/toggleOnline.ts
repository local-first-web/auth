import { commandFn } from '..'

export const toggleOnline: commandFn = subject => {
  const s = () => cy.wrap(subject)
  s()
    .find('.OnlineToggle')
    .then(toggle => {
      const prevState = toggle.attr('title')
      cy.wrap(toggle)
        .click()
        .then(() => {
          cy.wrap(toggle)
            .its('title')
            .should('not.equal', prevState)
        })
    })
}
