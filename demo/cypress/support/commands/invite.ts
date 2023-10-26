import { type CommandFn } from '../types'

export const SECOND = 1
export const MINUTE = 60 * SECOND
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR
export const WEEK = 7 * DAY

export type InviteOptions = {
  maxUses?: 1 | 5 | 10 | 0
  expiration?: typeof SECOND | typeof MINUTE
}

export const invite: CommandFn = (subject, options: InviteOptions = {}) => {
  const { maxUses = 1, expiration = MINUTE } = options
  const s = () => cy.wrap(subject)
  // click invite button
  s().findByText('Invite members').click()

  // set max uses
  s().findByLabelText('How many people can use this invitation code?').select(maxUses.toString())

  // set expiration
  s().findByLabelText('When does this invitation code expire?').select(expiration.toString())

  // press invite button
  s().findByText('Invite').click()

  // capture invitation code
  return s()
    .get('pre.InvitationCode')
    .then(pre => {
      s().findByText('Copy').click()
      const code = cy.wrap(pre).invoke('text')
      return code
    })
}
