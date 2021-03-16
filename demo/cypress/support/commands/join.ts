import { commandFn } from '../'

export const join: commandFn = (subject, code: string) => {
  const s = () => cy.wrap(subject)
  s()
    .wait(100)
    .findByText('Join team')
    .click()
  s()
    .get('input')
    .type(code)
  s()
    .findByText('Join')
    .click()
  return s()
    .userName()
    .then(userName =>
      s()
        .get('.MemberTable')
        .contains(userName)
    )
}
