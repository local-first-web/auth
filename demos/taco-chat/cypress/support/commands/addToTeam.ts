import { NOLOG, peer, wrap } from '../helpers.js'
import { type CommandFn } from '../types.js'

export const addToTeam: CommandFn = (subject, userName: string) => {
  const s = () => wrap(subject)
  return s()
    .invite()
    .then(code => {
      peer(userName).join(code)
    })
    .then(() => {
      s()
        .teamName()
        .then(teamName => peer(userName).teamName().should('equal', teamName))
      s().peerConnectionStatus(userName).should('equal', 'connected')
    })
    .then(() => s())
}
