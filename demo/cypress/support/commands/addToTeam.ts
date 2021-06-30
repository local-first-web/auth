import { commandFn } from '..'
import { peer } from '..'

export const addToTeam: commandFn = (subject, userName: string) => {
  const s = () => cy.wrap(subject)
  s()
    .invite()
    .then(code => {
      peer(userName).join(code)
    })
    .then(() =>
      s()
        .teamName()
        .then(teamName =>
          peer(userName)
            .teamName()
            .should('equal', teamName)
        )
    )
}
