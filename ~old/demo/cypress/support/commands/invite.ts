import { commandFn } from '../'

export const invite: commandFn = (subject, userName: string) => {
  const s = () => cy.wrap(subject)
  // click invite button
  s().findByText('Invite someone').click()

  // choose user from dropdown
  s().find('select').select(userName)

  // press invite button
  s().findByText('Invite').click()

  // capture invitation code
  return s()
    .get('pre.InvitationCode')
    .then(pre => {
      s().findByText('Copy').click()
      return cy.wrap(pre).invoke('text')
    })
}
