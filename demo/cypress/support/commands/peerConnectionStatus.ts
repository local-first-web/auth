import { NOLOG, wrap } from '../helpers'
import { type CommandFn } from '../types.js'

export const devices = {
  laptop: { name: 'laptop', emoji: '💻' },
  phone: { name: 'phone', emoji: '📱' },
} as Record<string, any>

export const peerConnectionStatus: CommandFn = (
  subject,
  userName: string,
  deviceName = 'laptop'
) => {
  const { emoji } = devices[deviceName]
  const connCell = wrap(subject)
    .teamMember(userName)
    .findByText(emoji, NOLOG)
    .parents('div', NOLOG)
    .first(NOLOG)
  return connCell.invoke(NOLOG, 'attr', 'title')
}
