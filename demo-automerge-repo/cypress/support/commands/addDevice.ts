import { peer } from '../helpers'
import { type CommandFn } from '../types'

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
        .then(teamName => peer(userName, deviceName).teamName().should('equal', teamName))
    )
    .then(() => s())
}
