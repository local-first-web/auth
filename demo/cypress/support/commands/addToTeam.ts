import { CommandFn } from '../types.js'
import { peer } from '../helpers'

export const addToTeam: CommandFn = (subject, userName: string) => {
  const s = () => cy.wrap(subject)
  return s()
    .invite()
    .then(code => {
      peer(userName).join(code)
    })
    .then(() => {
      s()
        .teamName()
        .then(teamName =>
          peer(userName)
            .teamName()
            .should('equal', teamName)
        )
      s()
        .peerConnectionStatus(userName)
        .should('equal', 'connected')
    })
    .then(() => s())
}
