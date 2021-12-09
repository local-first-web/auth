import {
  alice,
  aliceToAlice,
  aliceToBob,
  bob,
  bobToAlice,
  bobToBob,
  charlie,
  charlieToAlice,
  charlieToBob,
  charlieToCharlie,
  show,
} from '../support/helpers'

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

it('Bob promotes Charlie but is concurrently demoted. Charlie is not an admin.', () => {
  show('Bob:laptop')
  show('Charlie:laptop')
  alice()
    .addToTeam('Bob')
    .addToTeam('Charlie')
    .promote('Bob')

  // Alice goes offline
  alice().toggleOnline()

  // Bob promotes Charlie
  bob().promote('Charlie')

  // Bob and Charlie go offline
  bob().toggleOnline()
  charlie().toggleOnline()

  // Alice reconnects and demotes Bob
  alice().toggleOnline()
  alice().demote('Bob')

  // Bob and Charlie reconnect
  bob().toggleOnline()
  charlie().toggleOnline()

  // Bob is no longer an admin
  bobToBob().should('not.be.admin')
  bobToAlice().should('not.be.admin')

  // Charlie is no longer an admin
  charlieToBob().should('not.be.admin')
  charlieToAlice().should('not.be.admin')
})

it.only('Bob promotes Charlie but is concurrently removed. Charlie is not an admin.', () => {
  show('Bob:laptop')
  show('Charlie:laptop')
  alice()
    .addToTeam('Bob')
    .addToTeam('Charlie')
    .promote('Bob')

  // Alice goes offline
  alice().toggleOnline()

  // Bob promotes Charlie
  bob().promote('Charlie')

  // Bob and Charlie go offline
  bob().toggleOnline()
  charlie().toggleOnline()

  // Alice reconnects and removes Bob
  alice().toggleOnline()
  alice().remove('Bob')

  // Bob and Charlie reconnect
  bob().toggleOnline()
  charlie().toggleOnline()

  // Bob is no longer on the team
  alice().should('not.have.member', 'Bob')
  charlie().should('not.have.member', 'Bob')

  // Charlie is no longer an admin
  charlieToAlice().should('not.be.admin')
  charlieToCharlie().should('not.be.admin')
})

it.skip('Bob adds Charlie but is concurrently demoted. Charlie is not on the team.', () => {
  show('Bob:laptop')
  alice()
    .addToTeam('Bob')
    .promote('Bob')

  // Alice goes offline
  alice().toggleOnline()

  show('Charlie:laptop')
  bob().addToTeam('Charlie')

  // Bob and Charlie go offline
  bob().toggleOnline()
  charlie().toggleOnline()

  // Alice reconnects and demotes Bob
  alice().toggleOnline()
  alice().demote('Bob')

  // Bob and Charlie reconnect
  bob().toggleOnline()
  charlie().toggleOnline()

  // Bob is no longer an admin
  bobToBob().should('not.be.admin')
  bobToAlice().should('not.be.admin')

  // Charlie is not on the team
  alice().should('not.have.member', 'Charlie')
  bob().should('not.have.member', 'Charlie')
})
