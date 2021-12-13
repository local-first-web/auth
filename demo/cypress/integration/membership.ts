import { alice, bob, bobToAlice, bobToBob, show } from '../support/helpers'

it(`Alice promotes Bob after he joins`, () => {
  show('Bob:laptop')
  alice()
    .addToTeam('Bob')
    .promote('Bob')

  // Alice and Bob see that Bob is admin
  bobToAlice().should('be.admin')
  bobToBob().should('be.admin')
})

it(`Alice demotes Bob`, () => {
  show('Bob:laptop')
  alice().addToTeam('Bob')
  alice().promote('Bob')

  // Alice and Bob see that Bob is admin
  bobToAlice().should('be.admin')
  bobToBob().should('be.admin')

  // Alice demotes Bob
  alice().demote('Bob')

  // neither one sees Bob as admin
  bobToAlice().should('not.be.admin')
  bobToBob().should('not.be.admin')
})

it('Alice removes Bob from the team', () => {
  show('Bob:laptop')
  bob().should('be.onStartScreen')

  alice().addToTeam('Bob')
  bob().should('not.be.onStartScreen')

  // Alice removes Bob
  alice().remove('Bob')

  // Bob is no longer on the team - he is returned to the start screen
  bob().should('be.onStartScreen')
})
