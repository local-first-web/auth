import { add, bob, alice, peer } from '../support'

describe('taco-chat', () => {
  beforeEach(() => {
    cy.visit('/')
    localStorage.setItem('debug', 'lf:*')
  })

  describe('page loads', () => {
    it('we see just one peer, Alice', () => {
      cy.get('.Peer').should('have.length', 1)
      cy.get('.Peer')
        .userName()
        .should('equal', 'Alice')
    })

    it('we see the signature chain', () => {
      cy.get('.ChainDiagram')
        .get('svg')
        // has only one link
        .should('have.length', 1)
        // it's the ROOT
        .contains('ROOT')
    })
  })

  describe('we add Bob', () => {
    beforeEach(() => {
      add('Bob:laptop')
    })

    it('we see two peers, Alice and Bob', () => {
      cy.get('.Peer')
        // there are two
        .should('have.length', 2)
        // the second is Bob
        .eq(1)
        .contains('Bob')
    })

    describe('Bob creates another team', () => {
      beforeEach(() => {
        bob()
          // Click 'create team'
          .findByText('Create team')
          .click()
          // wait for the team name to show up
          .get('.TeamName')
      })

      it('Bob and Alice are on two different teams', () => {
        alice()
          .teamName()
          .then(teamName =>
            peer('Bob')
              .teamName()
              .should('not.equal', teamName)
          )
      })
    })

    describe('Alice promotes Bob before he joins', () => {
      it(`Alice sees that Bob is an admin`, () => {
        alice()
          .invite('Bob')
          .then(code => {
            alice().promote('Bob')
            // Alice sees that Bob is an admin
            alice()
              .teamMember('Bob')
              .findByTitle('Team admin (click to remove)')
              .should('have.length', '1')

            bob().join(code) // This kicks off the connection protocol.
            alice()
              .teamName()
              .then(teamName =>
                bob()
                  .teamName()
                  .should('equal', teamName)
              )
          })
      })
    })

    describe('Alice adds Bob to the team', () => {
      beforeEach(() => {
        alice().addToTeam('Bob')
      })

      it('has the same team for both peers', () => {
        alice()
          .teamName()
          .then(aliceTeamName =>
            bob()
              .teamName()
              .should('equal', aliceTeamName)
          )
      })

      it(`both peers have 'connected' status`, () => {
        alice()
          .connectionStatus('Bob')
          .should('equal', 'connected')
        bob()
          .connectionStatus('Alice')
          .should('equal', 'connected')
      })

      describe('then we remove Bob', () => {
        beforeEach(() => {
          bob().remove()
        })

        it(`we don't see Bob any more`, () => {
          cy.get('.Peer').should('have.length', 1)
          cy.get('.Peer')
            .userName()
            .should('equal', 'Alice')
        })
        it('Alice sees that Bob is disconnected', () => {
          alice()
            .connectionStatus('Bob')
            .should('equal', 'disconnected')
        })

        describe.skip('then we add Bob back', () => {
          beforeEach(() => {
            add('Bob:laptop')
            // TODO: now this is failing with "I couldn't verify your identity"
            // probably because Bob's keys haven't been updated somewhere
            // (same reason Bob can't do admin stuff even if he's admin)
          })
          it('Bob rejoins the team ', () => {
            cy.get('.Peer').should('have.length', 2)
            alice()
              .connectionStatus('Bob')
              .should('equal', 'connected')
          })
        })
      })

      describe('Alice promotes Bob', () => {
        beforeEach(() => {
          // Alice makes Bob an admin
          alice().promote('Bob')
        })

        it(`Alice and Bob see that Bob is admin`, () => {
          alice()
            .teamMember('Bob')
            .should('be.admin')
          bob()
            .teamMember('Bob')
            .should('be.admin')
        })

        describe.only('Bob adds Charlie to the team', () => {
          beforeEach(() => {
            add('Charlie:laptop')
            bob().addToTeam('Charlie')
          })
          it(`doesn't throw an error`, () => {})
        })

        describe('then Alice demotes Bob', () => {
          beforeEach(() => {
            // Alice removes Bob's admin role
            alice().demote('Bob')
          })

          it(`neither one sees Bob as admin`, () => {
            alice()
              .teamMember('Bob')
              .should('not.be.admin')
            bob()
              .teamMember('Bob')
              .should('not.be.admin')
          })
        })
      })
    })
  })
})
