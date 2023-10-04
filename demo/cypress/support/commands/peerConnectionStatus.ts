import { CommandFn } from '../types.js'
import { devices } from '../../../src/peers'

export const peerConnectionStatus: CommandFn = (
  subject,
  userName: string,
  deviceName: string = 'laptop'
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
