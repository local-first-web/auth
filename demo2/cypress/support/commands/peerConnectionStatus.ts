import { commandFn } from '..'

export const peerConnectionStatus: commandFn = (subject, userName: string) => {
  const connCell = cy
    .wrap(subject)
    .teamMember(userName)
    .findByText('💻')
    .parents('td')
    .first()
  return connCell.invoke('attr', 'title')
}
