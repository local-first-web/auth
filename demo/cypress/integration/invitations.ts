import { alice, alicePhone, bob, charlie, eve, show } from '../support'
import { hide } from '../support/commands'

beforeEach(() => {
  cy.visit('/')
  localStorage.setItem('debug', 'lf:*')
})

it('Alice invites Bob', () => {
  show('Bob:laptop')

  alice().should('not.have.member', 'Bob')
  bob().should('not.have.member', 'Alice')

  alice().addToTeam('Bob')

  // both peers have 'connected' status
  alice()
    .peerConnectionStatus('Bob')
    .should('equal', 'connected')
  bob()
    .peerConnectionStatus('Alice')
    .should('equal', 'connected')

  alice().should('have.member', 'Bob')
  bob().should('have.member', 'Alice')
})

it.only('Alice invites Bob and Charlie with a single code', () => {
  alice().should('not.have.member', 'Bob')
  alice().should('not.have.member', 'Charlie')

  alice()
    .invite({ maxUses: 5 })
    .then(code => {
      show('Bob:laptop')
      bob().join(code)
      show('Charlie:laptop')
      charlie().join(code)
    })
})

it(`Bob invites Charlie`, () => {
  show('Bob:laptop')
  alice()
    .addToTeam('Bob')
    .promote('Bob')

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

it(`Alice invites her phone`, () => {
  show('Alice:phone')
  alice().addDevice('phone')
})

it(`Alice's phone invites Bob`, () => {
  show('Alice:phone')
  alice().addDevice('phone')

  show('Bob:laptop')
  alicePhone().addToTeam('Bob')

  // both peers have 'connected' status
  alicePhone()
    .peerConnectionStatus('Bob')
    .should('equal', 'connected')
  bob()
    .peerConnectionStatus('Alice', 'phone')
    .should('equal', 'connected')
})

it(`Eve tries to reuse a single-use invitation`, () => {
  show('Bob:laptop')

  alice()
    .invite()
    .then(code => {
      bob().join(code)

      alice().should('have.member', 'Bob')
      bob().should('have.member', 'Alice')

      bob().hide()
      show('Eve:laptop')
      eve().join(code, { expectToFail: true })

      // foiled again
      alice().should('not.have.member', 'Eve')

      eve()
        .find('.Alerts')
        .should('contain', 'cannot be used again')
    })
})
