import { CommandFn } from '..'

export const peerConnectionStatus: CommandFn = (subject, userName: string) => {
  const connCell = cy
    .wrap(subject)
    .teamMember(userName)
    .findByText('💻')
    .parents('td')
    .first()
  return connCell.invoke('attr', 'title')
}
