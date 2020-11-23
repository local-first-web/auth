import { MachineConfig } from 'xstate'
import { ConnectionContext, ConnectionStateSchema } from '/connection/types'
import { ConnectionMessage } from '/connection/message'

// common timeout settings
const TIMEOUT_DELAY = 7000
const timeout = { after: { [TIMEOUT_DELAY]: { actions: 'failTimeout', target: '#failure' } } }

export const connectionMachine: MachineConfig<
  ConnectionContext,
  ConnectionStateSchema,
  ConnectionMessage
> = {
  id: 'connection',
  initial: 'disconnected',
  entry: ['sendHello'],

  on: {
    ERROR: {
      actions: 'receiveError',
      target: '#failure',
    },
  },

  states: {
    disconnected: {
      entry: 'onDisconnected',
      on: {
        HELLO: {
          actions: 'receiveHello',
          target: 'initializing',
        },
      },
    },

    // transient state to determine where to start
    initializing: {
      always: [
        // we can't both present invitations - someone has to be a member
        {
          cond: 'bothHaveInvitation',
          actions: ['failNeitherIsMember'],
          target: '#failure',
        },

        // if I have an invitation, wait for acceptance
        {
          cond: 'iHaveInvitation',
          target: 'awaitingInvitationAcceptance',
        },

        // if they have an invitation, validate it
        {
          cond: 'theyHaveInvitation',
          target: 'validatingInvitationProof',
        },

        // otherwise, we can proceed directly to authentication
        {
          target: 'authenticating',
        },
      ],
    },

    awaitingInvitationAcceptance: {
      // wait for them to validate the invitation we've shown
      on: {
        ACCEPT_INVITATION: [
          // make sure the team I'm joining is actually the one that invited me
          {
            cond: 'joinedTheRightTeam',
            actions: 'joinTeam',
            target: 'authenticating',
          },

          // if it's not, disconnect with error
          {
            actions: 'rejectTeam',
            target: '#failure',
          },
        ],
      },
      ...timeout,
    },

    validatingInvitationProof: {
      always: [
        // if the proof succeeds, add them to the team and send a welcome message,
        // then proceed to the standard identity claim & challenge process
        {
          cond: 'invitationProofIsValid',
          actions: 'acceptInvitation',
          target: 'authenticating',
        },

        // if the proof fails, disconnect with error
        {
          actions: 'rejectInvitation',
          target: '#failure',
        },
      ],
    },

    authenticating: {
      // these are two peers, mutually authenticating to each other;
      // so we have to complete two parallel processes:
      // 1. prove our identity
      // 2. verify our peer's identity
      type: 'parallel',

      states: {
        // 1. prove our identity
        claimingIdentity: {
          initial: 'awaitingIdentityChallenge',
          states: {
            // we claimed our identity already, in our HELLO message; now we wait for a challenge
            awaitingIdentityChallenge: {
              on: {
                CHALLENGE_IDENTITY: {
                  // when we receive a challenge, respond with proof
                  actions: ['proveIdentity'],
                  target: 'awaitingIdentityAcceptance',
                },
              },
              ...timeout,
            },

            // wait for a message confirming that they've validated our proof of identity
            awaitingIdentityAcceptance: {
              on: {
                ACCEPT_IDENTITY: {
                  // save the encrypted seed they provide; we'll use it to derive a shared secret
                  actions: 'storeTheirEncryptedSeed',
                  target: 'done',
                },
              },
              ...timeout,
            },

            done: { type: 'final' },
          },
        },

        // 2. verify the otherr peer's claimed identity: receive their claim, challenge it, and validate their proof
        verifyingIdentity: {
          initial: 'challengingIdentityClaim',
          states: {
            challengingIdentityClaim: {
              always: [
                // if we have a member by that name on the team, send a challenge
                {
                  cond: 'identityIsKnown',
                  actions: 'challengeIdentity',
                  target: 'awaitingIdentityProof',
                },

                // if we don't have anybody by that name in the team, disconnect with error
                {
                  actions: 'rejectIdentity',
                  target: '#failure',
                },
              ],
            },

            // then wait for them to respond to the challenge with proof
            awaitingIdentityProof: {
              on: {
                PROVE_IDENTITY: [
                  // if the proof succeeds, we're done on our side
                  {
                    cond: 'identityProofIsValid',
                    actions: ['generateSeed', 'acceptIdentity'],
                    target: 'done',
                  },

                  // if the proof fails, disconnect with error
                  {
                    actions: 'rejectIdentity',
                    target: '#failure',
                  },
                ],
              },
              ...timeout,
            },

            done: { type: 'final' },
          },
        },
      },

      // Once BOTH processes complete, we continue

      // Before connecting, we make sure sure we have the signature chain on both sides
      onDone: {
        // send our head & hashes to tell them what we know
        actions: 'sendUpdate',
        target: 'updating',
      },
    },

    /*
NEXT

Pretty sure what needs to happen is the `updating` state needs to be divided into several states.


updating
  on
    UPDATE
      actions: recordTheirHead
      target: receivingUpdate      
    MISSING_LINKS
      actions: receiveMissingLinks
      target: receivingMissingLinks 

  initial: sendingUpdate 

  states
    
    sendingUpdate
      entry: sendUpdate
      always: waiting

    receivingUpdate
      // if our heads are equal, we're done
      - cond: headsAreEqual
        target: #connected

      // otherwise see if we have anything they don't
      - target: sendingMissingLinks

    sendingMissingLinks
      entry: sendMissingLinks
      always: waiting

    receivingMissingLinks
      // if our heads are now equal, we're done
      - cond: headsAreEqual
        target: #connected

      // otherwise we're waiting for them to get missing links from us & confirm
      - target: waiting

      exit: sendUpdate // either way let them know our status

    waiting


*/

    // having established each others' identities, we now make sure that our team signature chains are up to date
    updating: {
      initial: 'sendingUpdate',
      on: {
        // when they send us their head & hashes,
        UPDATE: [
          // if we have the same head, then we're caught up
          {
            actions: 'recordTheirHead',
            target: 'updating.receivingUpdate',
          },
        ],

        // when they send us missing links, add them to our chain
        MISSING_LINKS: {
          actions: ['recordTheirHead', 'receiveMissingLinks'],
          target: 'updating.receivingMissingLinks',
        },
      },
      states: {
        sendingUpdate: {
          entry: 'sendUpdate',
          always: 'waiting',
        },
        receivingUpdate: {
          always: [
            // if our heads are equal, we're done
            { cond: 'headsAreEqual', target: 'done' },
            // otherwise see if we have anything they don't
            { target: 'sendingMissingLinks' },
          ],
        },
        sendingMissingLinks: {
          entry: 'sendMissingLinks',
          always: 'waiting',
        },
        receivingMissingLinks: {
          always: [
            // if our heads are now equal, we're done
            { cond: 'headsAreEqual', target: 'done' },
            // otherwise we're waiting for them to get missing links from us & confirm
            { target: 'waiting' },
          ],
          exit: 'sendUpdate', // either way let them know our status
        },
        waiting: {},
        done: { type: 'final' },
      },
      onDone: 'connected',
    },

    connected: {
      entry: ['deriveSharedKey', 'onConnected'],
      on: {
        DISCONNECT: 'disconnected',
        UPDATE: {
          cond: 'headsAreDifferent',
          target: 'updating',
        },
      },
    },

    failure: {
      id: 'failure',
      always: 'disconnected',
    },
  },
}
