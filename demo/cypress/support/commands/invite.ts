import { CommandFn } from '../'

export const invite: CommandFn = subject => {
  const s = () => cy.wrap(subject)
  // click invite button
  s()
    .findByText('Invite members')
    .click()

  // press invite button
  s()
    .findByText('Invite')
    .click()

  // capture invitation code
  return s()
    .get('pre.InvitationCode')
    .then(pre => {
      s()
        .findByText('Copy')
        .click()
      return cy.wrap(pre).invoke('text')
    })
}
