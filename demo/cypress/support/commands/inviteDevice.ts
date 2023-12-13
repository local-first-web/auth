import { NOLOG, wrap } from '../helpers'
import { type CommandFn } from '../types.js'

export const inviteDevice: CommandFn = subject => {
  const s = () => wrap(subject)
  // click invite button
  s().findByText('Add a device', NOLOG).click(NOLOG)

  // capture invitation code
  return s()
    .get('pre.InvitationCode')
    .then(pre => {
      s().findByText('Copy', NOLOG).click(NOLOG)
      const code = wrap(pre).invoke(NOLOG, 'text')
      return code
    })
}
