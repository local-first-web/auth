import {
  alice,
  aliceToAlice,
  aliceToBob,
  bob,
  bobToAlice,
  bobToBob,
  charlie,
  show,
} from '../support'

beforeEach(() => {
  cy.visit('/')
  localStorage.setItem('debug', 'lf:*')
})

it(`Alice and Bob demote each other concurrently`, () => {
  show('Bob:laptop')
  alice().addToTeam('Bob')

  // Only Alice is admin
  aliceToAlice().should('be.admin')
  bobToAlice().should('not.be.admin')
  aliceToBob().should('be.admin')
  bobToBob().should('not.be.admin')

  // Alice promotes Bob
  alice().promote('Bob')

  // Now both are admins
  aliceToAlice().should('be.admin')
  bobToAlice().should('be.admin')
  aliceToBob().should('be.admin')
  bobToBob().should('be.admin')

  // Alice and Bob both disconnect
  alice().toggleOnline()
  bob().toggleOnline()

  // They demote each other
  alice().demote('Bob')
  bob().demote('Alice')

  // They both reconnect
  alice().toggleOnline()
  bob().toggleOnline()

  // Alice is admin, Bob is not
  aliceToAlice().should('be.admin')
  bobToAlice().should('not.be.admin')
  aliceToBob().should('be.admin')
  bobToBob().should('not.be.admin')
})

it(`Alice and Bob remove each other concurrently; Charlie is able to get both sides of the story`, () => {
  show('Bob:laptop')
  show('Charlie:laptop')
  alice()
    .addToTeam('Bob')
    .addToTeam('Charlie')
    .promote('Bob')

  // both Alice and Bob go offline
  alice().toggleOnline()
  bob().toggleOnline()

  // they remove each other
  bob().remove('Alice')
  alice().remove('Bob')

  // Bob reconnects first
  bob().toggleOnline()

  // Charlie now believes that Alice was removed
  charlie().should('not.have.member', 'Alice')
  charlie().should('have.member', 'Bob')

  // Alice reconnects
  alice().toggleOnline()

  // Charlie gets Alice's side of the story, so he concludes that Bob should be removed
  charlie().should('have.member', 'Alice')
  charlie().should('not.have.member', 'Bob')
})
