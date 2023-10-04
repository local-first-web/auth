import { CommandFn } from '../types.js'
import { peer } from '../helpers'

export const addDevice: CommandFn = (subject, deviceName: string) => {
  const s = () => cy.wrap(subject)
  let userName: string
  s()
    .userName()
    .then(name => (userName = name))
  return s()
    .inviteDevice()
    .then(code => {
      peer(userName, deviceName).join(code)
    })
    .then(() =>
      s()
        .teamName()
        .then(teamName =>
          peer(userName, deviceName)
            .teamName()
            .should('equal', teamName)
        )
    )
    .then(() => s())
}
