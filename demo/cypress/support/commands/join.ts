import { CommandFn } from '../'

export const join: CommandFn = (subject, code: string, options = { expectToFail: true }) => {
  const { expectToFail } = options
  const s = () => cy.wrap(subject)
  s()
    .wait(100)
    .findByText('Join team')
    .click()
  s()
    .findByLabelText('Invitation code')
    .type(code)
  s()
    .findByText('Join')
    .click()
  return s()
    .userName()
    .then(userName =>
      s()
        .get('.MemberTable')
        .should(expectToFail ? 'not.contain' : 'contain', userName)
    )
}
