import { alice, bob, bobToAlice, bobToBob, show } from '../support/helpers'

it('Alice disconnects and reconnects', () => {
  show('Bob:laptop')
  alice().addToTeam('Bob')

  // Alice is connected to the relay server
  alice().should('be.online')

  // she disconnects
  alice()
    .toggleOnline()
    .should('not.be.online')

  // she is not connected to Bob
  alice()
    .peerConnectionStatus('Bob')
    .should('not.equal', 'connected')

  // she reconnects
  alice()
    .toggleOnline()
    .should('be.online')

  // she is connected again to Bob
  alice()
    .peerConnectionStatus('Bob')
    .should('equal', 'connected')
})

it(`Alice disconnects, promotes Bob then reconnects`, () => {
  show('Bob:laptop')
  alice().addToTeam('Bob')

  // Alice disconnects
  alice()
    .toggleOnline()
    .should('not.be.online')

  // Alice promotes Bob
  alice().promote('Bob')

  // Alice sees that Bob is admin
  bobToAlice().should('be.admin')

  // Alice reconnects
  alice()
    .toggleOnline()
    .should('be.online')

  // Alice is connected again to Bob
  alice()
    .peerConnectionStatus('Bob')
    .should('equal', 'connected')

  // Alice sees that Bob is admin
  bobToAlice().should('be.admin')

  // Bob sees that Bob is admin
  bobToBob().should('be.admin')
})

it(`Alice disconnects, demotes Bob then reconnects`, () => {
  show('Bob:laptop')
  alice().addToTeam('Bob')

  alice().promote('Bob')

  // Alice disconnects
  alice()
    .toggleOnline()
    .should('not.be.online')

  // Alice demotes Bob
  alice().demote('Bob')

  // Alice reconnects
  alice()
    .toggleOnline()
    .should('be.online')

  // Alice sees that Bob is no longer admin
  bobToAlice().should('not.be.admin')

  // Bob sees that he is no longer admin
  bobToBob().should('not.be.admin')
})

it('Fun with disconnecting and reconnecting', () => {
  show('Bob:laptop')
  alice().addToTeam('Bob')

  const expectConnected = (value: boolean) => {
    const compare = value ? 'equal' : 'not.equal'
    alice()
      .peerConnectionStatus('Bob')
      .should(compare, 'connected')
    bob()
      .peerConnectionStatus('Alice')
      .should(compare, 'connected')
  }

  expectConnected(true)

  // Alice disconnects and reconnects
  alice().toggleOnline()
  expectConnected(false)

  alice().toggleOnline()
  expectConnected(true)

  // Bob disconnects and reconnects
  bob().toggleOnline()
  expectConnected(false)

  bob().toggleOnline()
  expectConnected(true)

  // Bob and Alice both disconnect
  bob().toggleOnline()
  expectConnected(false)

  alice().toggleOnline()
  expectConnected(false)

  // Alice reconnects
  alice().toggleOnline()
  expectConnected(false) // Bob is still disconnected

  // Bob reconnects
  bob().toggleOnline()
  expectConnected(true) // now both are connected
})
