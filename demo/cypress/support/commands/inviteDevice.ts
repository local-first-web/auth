import { CommandFn } from '../types'

export const inviteDevice: CommandFn = subject => {
  const s = () => cy.wrap(subject)
  // click invite button
  s()
    .findByText('Add a device')
    .click()

  // capture invitation code
  return s()
    .get('pre.InvitationCode')
    .then(pre => {
      s()
        .findByText('Copy')
        .click()
      const code = cy.wrap(pre).invoke('text')
      return code
    })
}
