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
  const connCell = cy.wrap(subject).teamMember(userName).findByText(emoji).parents('div').first()
  return connCell.invoke('attr', 'title')
}
