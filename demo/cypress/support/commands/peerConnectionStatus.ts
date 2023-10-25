import { devices } from '../../../src/peers'
import { type CommandFn } from '../types.js'

export const peerConnectionStatus: CommandFn = (
  subject,
  userName: string,
  deviceName = 'laptop'
) => {
  const { emoji } = devices[deviceName]
  const connCell = cy
    .wrap(subject)
    .teamMember(userName)
    .findByText(emoji)
    .parents('div')
    .first()
  return connCell.invoke('attr', 'title')
}
