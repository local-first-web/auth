import { show, alice, bob, charlie } from '../support'

describe('taco-chat', () => {
  beforeEach(() => {
    cy.visit('/')
    localStorage.setItem('debug', 'lf:*')
  })

  it('We load the page', () => {
    // we see just one peer, Alice
    cy.get('.Peer').should('have.length', 1)
    cy.get('.Peer')
      .userName()
      .should('equal', 'Alice')

    // we see the signature chain
    cy.get('.ChainDiagram')
      .get('svg')
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

  it('Alice adds Bob to team', () => {
    show('Bob:laptop')
    alice().addToTeam('Bob')

    // alice and bob see the same team name
    alice()
      .teamName()
      .then(aliceTeamName =>
        bob()
          .teamName()
          .should('equal', aliceTeamName)
      )

    // both peers have 'connected' status
    alice()
      .peerConnectionStatus('Bob')
      .should('equal', 'connected')
    bob()
      .peerConnectionStatus('Alice')
      .should('equal', 'connected')
  })

  it(`Alice promotes Bob after he joins`, () => {
    show('Bob:laptop')
    alice().addToTeam('Bob')

    // Alice promotes Bob to admin
    alice().promote('Bob')

    // Alice and Bob see that Bob is admin
    alice()
      .teamMember('Bob')
      .should('be.admin')
    bob()
      .teamMember('Bob')
      .should('be.admin')
  })

  it(`Bob adds Charlie to the team`, () => {
    show('Bob:laptop')
    alice().addToTeam('Bob')
    alice().promote('Bob')

    // show Charlie's device
    show('Charlie:laptop')

    // Bob adds Charlie to the team
    bob().addToTeam('Charlie')

    // Charlie's on the team and everyone can see it
    alice().isConnectedTo('Bob')
    alice().isConnectedTo('Charlie')
    bob().isConnectedTo('Alice')
    bob().isConnectedTo('Charlie')
    charlie().isConnectedTo('Alice')
    charlie().isConnectedTo('Bob')
  })

  it(`Alice demotes Bob`, () => {
    show('Bob:laptop')
    alice().addToTeam('Bob')
    alice().promote('Bob')

    // Alice and Bob see that Bob is admin
    alice()
      .teamMember('Bob')
      .should('be.admin')
    bob()
      .teamMember('Bob')
      .should('be.admin')

    // Alice demotes Bob
    alice().demote('Bob')

    // neither one sees Bob as admin
    alice()
      .teamMember('Bob')
      .should('not.be.admin')
    bob()
      .teamMember('Bob')
      .should('not.be.admin')
  })

  it('Alice disconnects and reconnects', () => {
    show('Bob:laptop')
    alice().addToTeam('Bob')

    // Alice is connected to the server
    alice().should('be.online')

    // she disconnects
    alice().toggleOnline()

    // she is not connected to the server
    alice().should('not.be.online')

    // she is not connected to Bob
    alice()
      .peerConnectionStatus('Bob')
      .should('not.equal', 'connected')

    // she reconnects
    alice().toggleOnline()

    // she is connected again to the server
    alice().should('be.online')

    // she is connected again to Bob
    alice()
      .peerConnectionStatus('Bob')
      .should('equal', 'connected')
  })

  it(`Alice disconnects, promotes Bob then reconnects`, () => {
    show('Bob:laptop')
    alice().addToTeam('Bob')

    // Alice disconnects
    alice().toggleOnline()

    // Alice is disconnected
    alice()
      .peerConnectionStatus('Bob')
      .should('equal', 'disconnected')

    // Alice promotes Bob
    alice().promote('Bob')

    // Alice reconnects
    alice().toggleOnline()

    // Alice is connected again to Bob
    alice()
      .peerConnectionStatus('Bob')
      .should('equal', 'connected')

    // Alice sees that Bob is admin
    alice()
      .teamMember('Bob')
      .should('be.admin')

    // Bob sees that Bob is admin
    bob()
      .teamMember('Bob')
      .should('be.admin')
  })

  it(`Alice disconnects, demotes Bob then reconnects`, () => {
    show('Bob:laptop')
    alice().addToTeam('Bob')
    alice().promote('Bob')

    // Alice disconnects

    alice().toggleOnline()
    alice().should('not.be.online')

    // Alice demotes Bob

    alice().demote('Bob')

    // Alice reconnects

    alice()
      .toggleOnline()
      .should('be.online')

    // Bob sees that he is no longer admin

    alice()
      .teamMember('Bob')
      .should('not.be.admin')
    bob()
      .teamMember('Bob')
      .should('not.be.admin')
  })

  it(`Alice and Bob demote each other concurrently`, () => {
    show('Bob:laptop')
    alice().addToTeam('Bob')
    alice().promote('Bob')

    // Alice and Bob both disconnect

    alice().toggleOnline()
    alice().should('not.be.online')

    bob().toggleOnline()
    bob().should('not.be.online')

    // They demote each other

    alice().demote('Bob')
    bob().demote('Alice')

    // They both reconnect

    alice()
      .toggleOnline()
      .should('be.online')

    bob()
      .toggleOnline()
      .should('be.online')

    // Alice is admin, Bob is not

    alice()
      .teamMember('Bob')
      .should('not.be.admin')
    bob()
      .teamMember('Bob')
      .should('not.be.admin')
    alice()
      .teamMember('Alice')
      .should('be.admin')
    bob()
      .teamMember('Alice')
      .should('be.admin')
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

  it('Alice removes Bob from the team', () => {
    show('Bob:laptop')
    alice().addToTeam('Bob')

    // Alice removes Bob
    alice().remove('Bob')

    // Bob is no longer on the team
    bob()
      .findByText('Create team')
      .should('exist')
    bob()
      .findByText('Join team')
      .should('exist')
    bob()
      .find('.TeamName')
      .should('not.exist')
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

  it.only(`Alice adds her phone`, () => {
    show('Alice:phone')

    alice().addDevice('phone')
  })
})
