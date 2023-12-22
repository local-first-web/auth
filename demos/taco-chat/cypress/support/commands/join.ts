import { NOLOG, wrap } from '../helpers'
import { type CommandFn } from '../types.js'

export const join: CommandFn = (subject, code: string, options = { expectToFail: false }) => {
  const { expectToFail } = options
  const s = () => wrap(subject)
  s().wait(100).findByText('Join team', NOLOG).click(NOLOG)
  s().findByLabelText('Invitation code', NOLOG).type(code)
  s().findByText('Join').click()
  return s()
    .userName()
    .then(userName =>
      s()
        .get('.MemberTable', NOLOG)
        .should(expectToFail ? 'not.contain' : 'contain', userName)
    )
}
