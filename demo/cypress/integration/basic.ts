import { alice, bob, show } from '../support/helpers'

it('We load the page', () => {
  // we see just one peer, Alice
  cy.get('.Peer').should('have.length', 1)
  cy.get('.Peer')
    .userName()
    .should('equal', 'Alice')

  // we see Alice's Chain
  alice()
    .chain()
    // has just one link
    .should('have.length', 1)
    // it's the ROOT
    .contains('ROOT')
})

it(`We show Bob's device`, () => {
  show('Bob:laptop')
  cy.get('.Peer')
    // there are two
    .should('have.length', 2)
    // the second is Bob
    .eq(1)
    .contains('Bob')
})

it(`We hide Bob's device`, () => {
  show('Bob:laptop')
  alice().addToTeam('Bob')

  // we hide Bob's device
  bob().hide()

  // we don't see Bob any more
  cy.get('.Peer').should('have.length', 1)
  cy.get('.Peer')
    .userName()
    .should('equal', 'Alice')

  // Alice sees that Bob is disconnected
  alice()
    .peerConnectionStatus('Bob')
    .should('equal', 'disconnected')
})

it(`We show Bob's device again`, () => {
  show('Bob:laptop')
  alice().addToTeam('Bob')

  // we hide Bob's device
  bob().hide()

  // we show Bob's device again
  show('Bob:laptop')
  cy.get('.Peer').should('have.length', 2)
  bob().toggleOnline()
  // Bob rejoins the team

  // Alice sees that Bob is reconnected
  alice()
    .peerConnectionStatus('Bob')
    .should('equal', 'connected')
})

it('Bob creates another team', () => {
  show('Bob:laptop')
  bob()
    // Click 'create team'
    .findByText('Create team')
    .click()
    // wait for the team name to show up
    .get('.TeamName')
  alice()
    .teamName()
    .then(teamName =>
      bob()
        .teamName()
        .should('not.equal', teamName)
    )
})

it('Alice creates an invitation', () => {
  // This test is just making sure that user actions are immediately visible and don't have to wait
  // for a synchronization round trip
  alice()
    .chain()
    .should('have.length', 1)

  alice().invite()

  alice()
    .chain()
    .should('have.length', 2)
})
