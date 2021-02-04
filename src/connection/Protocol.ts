﻿import { asymmetric } from '@herbcaudill/crypto'
import { EventEmitter } from 'events'
import * as R from 'ramda'
import { assign, createMachine, interpret, Interpreter } from 'xstate'
import { protocolMachine } from './protocolMachine'
import { getParentHashes, TeamLinkMap } from '/chain'
import { deriveSharedKey } from '/connection/deriveSharedKey'
import * as identity from '/connection/identity'
import {
  AcceptInvitationMessage,
  ChallengeIdentityMessage,
  ConnectionMessage,
  DisconnectMessage,
  ErrorMessage,
  HelloMessage,
  LocalUpdateMessage,
  MissingLinksMessage,
  NumberedConnectionMessage,
  ProveIdentityMessage,
  SeedMessage,
  UpdateMessage,
} from '/connection/message'
import { orderedDelivery } from '/connection/orderedDelivery'
import {
  Condition,
  ConnectionContext,
  ConnectionParams,
  ConnectionState,
  hasInvitee,
  InitialContext,
  SendFunction,
  StateMachineAction,
} from '/connection/types'
import * as invitations from '/invitation'
import { create, KeyType, randomKey } from '/keyset'
import { Team } from '/team'
import { arrayToMap, assert, debug } from '/util'

const { MEMBER } = KeyType

// NEXT: InitialContext needs to have two possible states - member or non-member

/**
 * Wraps a state machine (using [XState](https://xstate.js.org/docs/)) that
 * implements the connection protocol. The XState configuration is in `machineConfig`.
 */
export class Protocol extends EventEmitter {
  private log: debug.Debugger

  private sendMessage: SendFunction
  private machine: Interpreter<ConnectionContext, ConnectionState, ConnectionMessage>
  private incomingMessageQueue: Record<number, NumberedConnectionMessage> = {}
  private outgoingMessageIndex: number = 0
  private isRunning: boolean = false

  constructor({ sendMessage, context }: ConnectionParams) {
    super()

    const debugLabel = hasInvitee(context) ? context.invitee.name : context.user.userName
    this.log = debug(`lf:auth:protocol:${debugLabel}`)

    this.sendMessage = (message: ConnectionMessage) => {
      const index = this.outgoingMessageIndex++
      this.logMessage('out', message, index)
      sendMessage({ ...message, index })
    }
    // define state machine
    const machine = createMachine(protocolMachine, {
      actions: this.actions,
      guards: this.guards,
    }).withContext(context)

    // instantiate the machine
    this.machine = interpret(machine).onTransition((state) => {
      const summary = stateSummary(state.value)
      this.emit('change', summary)
      this.log(`⏩ ${summary}`)
    })
  }

  /** Starts (or restarts) the protocol machine. Returns this Protocol object. */
  public start = (context?: Partial<InitialContext>) => {
    this.log('starting')
    if (!this.isRunning) {
      this.machine.start()
      this.isRunning = true
      this.sendMessage({ type: 'READY' })
    } else {
      this.machine.send({ type: 'RECONNECT' })
    }
    return this
  }

  /** Sends a disconnect message to the peer. */
  public stop = () => {
    const disconnectMessage = { type: 'DISCONNECT' } as DisconnectMessage
    this.sendMessage(disconnectMessage) // send disconnect message to peer
    if (this.isRunning && !this.machine.state.done) {
      this.machine.send(disconnectMessage) // send disconnect event to local machine
    }
    this.removeAllListeners()
    return this
  }

  get userName() {
    if (!this.isRunning) return ''
    return hasInvitee(this.context) ? this.context.invitee.name : this.context.user!.userName
  }

  /** Returns the current state of the protocol machine. */
  get state() {
    if (!this.isRunning) return 'disconnected'
    else return this.machine.state.value
  }

  get context(): ConnectionContext {
    if (!this.isRunning) throw new Error(`Can't get context; machine not started`)
    return this.machine.state.context
  }

  get user() {
    return this.context.user
  }

  /** Returns the last error encountered by the protocol machine.
   * If no error has occurred, returns undefined.
   */
  get error() {
    return this.context.error
  }

  /** Returns the team that the connection's user is a member of.
   * If the user has not yet joined a team, returns undefined.
   */
  get team() {
    return this.context.team
  }

  /** Returns the connection's session key Jwhen we are in a connected state.
   * Otherwise, returns `undefined`.
   */
  get sessionKey() {
    return this.context.sessionKey
  }

  get peerName() {
    if (!this.isRunning) return '? (not started)'
    return (
      this.context.peer?.userName ??
      this.context.theirIdentityClaim?.name ??
      this.context.theirProofOfInvitation?.invitee.name ??
      '?'
    )
  }

  // TODO: This probably should be implemented as a separate duplex stream in the pipeline

  /** Passes an incoming message from the peer on to this protocol machine, guaranteeing that
   *  messages will be delivered in the intended order (according to the `index` field on the message) */
  public async deliver(incomingMessage: NumberedConnectionMessage) {
    this.logMessage('in', incomingMessage, incomingMessage.index)
    const { queue, nextMessages } = orderedDelivery(this.incomingMessageQueue, incomingMessage)

    // TODO: detect hang when we've got message N+1 and message N doesn't come in for a while?

    // update queue
    this.incomingMessageQueue = queue

    // send any messages that are ready to go out
    for (const m of nextMessages) {
      if (this.isRunning && !this.machine.state.done) this.machine.send(m)
      else this.log(`stopped, not sending #${incomingMessage.index}`)
    }
  }

  // ACTIONS

  private fail = (message: string, details?: any) =>
    assign({
      error: (context, event) => {
        const errorPayload = { message, details }
        const errorMessage: ErrorMessage = { type: 'ERROR', payload: errorPayload }
        this.machine.send(errorMessage) // force error state locally
        this.sendMessage(errorMessage) // send error to peer
        return errorPayload
      },
    })

  /** These are referred to by name in `connectionMachine` (e.g. `actions: 'sendHello'`) */
  private readonly actions: Record<string, StateMachineAction> = {
    sendHello: async (context) => {
      const payload = hasInvitee(context)
        ? { proofOfInvitation: this.myProofOfInvitation(context) }
        : { identityClaim: { type: MEMBER, name: context.user!.userName } }
      this.sendMessage({
        type: 'HELLO',
        payload,
      })
    },

    // authenticating

    // TODO: authentication should always use device keys, not member keys

    receiveHello: assign({
      theirIdentityClaim: (_, event) => {
        event = event as HelloMessage
        return 'identityClaim' in event.payload ? event.payload.identityClaim : undefined
      },

      theyHaveInvitation: (_, event) => {
        event = event as HelloMessage
        return 'proofOfInvitation' in event.payload
      },

      theirProofOfInvitation: (_, event) => {
        event = event as HelloMessage
        return 'proofOfInvitation' in event.payload ? event.payload.proofOfInvitation : undefined
      },
    }),

    acceptInvitation: (context) => {
      assert(context.team)
      // welcome them by sending the team's signature chain, so they can reconstruct team membership state
      this.sendMessage({
        type: 'ACCEPT_INVITATION',
        payload: { chain: context.team.save() },
      } as AcceptInvitationMessage)
    },

    joinTeam: assign({
      team: (context, event) => {
        // we've just received the team's signature chain; reconstruct team
        const team = this.rehydrateTeam(context, event)

        // TODO:
        // This assumes we have `context.user` but if we're a device with an invitation, we don't know what user we are.
        // Basically we'd want to do the same thing as we do here, but with device keys. Then once we've joined we can populate
        // `context.user` from information on the team.

        // BUT we're currently not making user->device lockboxes so we need to put that in place

        // ALSO if we don't have a user then we can't rehydrate the team because that has to be in
        // context.
        // - maybe Team shouldn't require a User in context, but only a Device, because with the
        //   device we can access the user's stuff
        //

        if (context.user) {
          // first create new keys for ourselves to replace the ephemeral ones from the invitation
          context.user.keys = create({ type: KeyType.MEMBER, name: context.user.userName })

          // also
          // when I invite a device, I'm not entering anything about it - I'm not giving it a name
          // or type or anything. that information should come from the device itself

          // join the team
          const proof = this.myProofOfInvitation(context)
          team.join(proof, context.user.keys)
        }

        // put the team in our context
        return team
      },
    }),

    challengeIdentity: (context) => {
      const identityClaim = context.theirIdentityClaim!
      const challenge = identity.challenge(identityClaim)
      context.challenge = challenge
      this.sendMessage({
        type: 'CHALLENGE_IDENTITY',
        payload: { challenge },
      } as ChallengeIdentityMessage)
    },

    proveIdentity: (context, event) => {
      assert(context.user)
      const { challenge } = (event as ChallengeIdentityMessage).payload
      const proof = identity.prove(challenge, context.user.keys)
      this.sendMessage({
        type: 'PROVE_IDENTITY',
        payload: { challenge, proof },
      } as ProveIdentityMessage)
    },

    storePeer: assign({
      peer: (context) => {
        assert(context.team)
        assert(context.theirIdentityClaim)
        return context.team.members(context.theirIdentityClaim.name)
      },
    }),

    acceptIdentity: (_) => {
      this.sendMessage({
        type: 'ACCEPT_IDENTITY',
        payload: {},
      })
    },

    // updating

    sendUpdate: (context) => {
      assert(context.team)
      const { root, head, links } = context.team.chain
      const hashes = Object.keys(links)
      this.sendMessage({
        type: 'UPDATE',
        payload: { root, head, hashes },
      })
    },

    recordTheirHead: assign({
      theirHead: (_, event) => {
        const { payload } = event as UpdateMessage | MissingLinksMessage
        return payload.head
      },
    }),

    sendMissingLinks: (context, event) => {
      assert(context.team)
      const { chain } = context.team
      const { root, head, links } = chain
      const hashes = Object.keys(links)

      const {
        root: theirRoot,
        head: theirHead,
        hashes: theirHashes,
      } = (event as UpdateMessage).payload

      assert(root === theirRoot, `Our roots should be the same`)

      // if we have the same head, there are no missing links
      if (theirHead === head) return

      // send them every link that we have that they don't have
      const missingLinks = hashes
        .filter((hash) => theirHashes.includes(hash) === false)
        .map((hash) => links[hash])

      if (missingLinks.length > 0) {
        this.sendMessage({
          type: 'MISSING_LINKS',
          payload: { head, links: missingLinks },
        })
      }
    },

    receiveMissingLinks: assign({
      team: (context, event) => {
        assert(context.team)
        const { chain } = context.team

        const { root, links } = chain
        const { head: theirHead, links: theirLinksArray } = (event as MissingLinksMessage).payload
        const theirLinks = theirLinksArray.reduce(arrayToMap('hash'), {})

        const allLinks = {
          // all our links
          ...links,
          // all their new links, converted from an array to a hashmap
          ...theirLinks,
        } as TeamLinkMap

        // make sure we're not missing any links that are referenced by these new links (shouldn't happen)
        const parentHashes = theirLinksArray.flatMap((link) => getParentHashes(chain, link))
        const missingParents = parentHashes.filter((hash) => !(hash in allLinks))
        assert(
          missingParents.length === 0,
          `Can't update; missing parent links: \n${missingParents.join('\n')}`
        )

        // we can now reconstruct their chain
        const theirChain = { root, head: theirHead, links: allLinks }

        // and merge with it
        return context.team.merge(theirChain)
      },
    }),

    refreshContext: assign({
      // Following an update, we may have new information about the peer
      // (specifically, if they just joined with an invitation, we'll have received
      // their real public keys). So we need to get that on context now.
      peer: (context) => {
        assert(context.peer)
        assert(context.team)
        const userName = context.peer.userName
        if (context.team.has(userName)) {
          // peer still on the team
          return context.team.members(userName)
        } else {
          // peer was removed from team
          return undefined
        }
      },
    }),

    listenForUpdates: (context) => {
      assert(context.team)
      context.team.addListener('updated', ({ head }) => {
        if (!this.machine.state.done) {
          this.log(`LOCAL_UPDATE ${head}`)
          this.machine.send({ type: 'LOCAL_UPDATE', payload: { head } }) // send update event to local machine
        }
      })
    },

    // negotiating

    generateSeed: assign({ seed: (_) => randomKey() }),

    sendSeed: (context) => {
      assert(context.user)
      assert(context.peer)
      assert(context.seed)

      this.sendMessage({
        type: 'SEED',
        payload: {
          encryptedSeed: asymmetric.encrypt({
            secret: context.seed,
            recipientPublicKey: context.peer.keys.encryption,
            senderSecretKey: context.user.keys.encryption.secretKey,
          }),
        },
      })
    },

    receiveSeed: assign({
      theirEncryptedSeed: (_, event) => {
        return (event as SeedMessage).payload.encryptedSeed
      },
    }),

    deriveSharedKey: assign({
      sessionKey: (context, event) => {
        assert(context.user)
        assert(context.theirEncryptedSeed)
        assert(context.seed)
        assert(context.peer)

        // we saved our seed in context
        const ourSeed = context.seed

        // their seed is encrypted and stored in context
        const theirSeed = asymmetric.decrypt({
          cipher: context.theirEncryptedSeed,
          senderPublicKey: context.peer.keys.encryption,
          recipientSecretKey: context.user.keys.encryption.secretKey,
        })

        // with the two keys, we derive a shared key
        return deriveSharedKey(ourSeed, theirSeed)
      },
    }),

    // failure

    receiveError: assign({
      error: (_, event) => (event as ErrorMessage).payload,
    }),

    rejectIdentity: this.fail(`I couldn't verify your identity.`),
    failNeitherIsMember: this.fail(`We can't connect because neither one of us is a member.`),
    rejectInvitation: this.fail(`Your invitation didn't work - maybe the code was mistyped?`),
    rejectTeam: this.fail(`This is not the team I was invited to.`),
    failPeerWasRemoved: this.fail(`You were removed from the team.`),
    failTimeout: this.fail('Connection timed out.'),

    // events for external listeners

    onConnected: () => this.emit('connected'),
    onJoined: () => this.emit('joined'),
    onUpdated: () => this.emit('updated'),
    onDisconnected: (_, event) => this.emit('disconnected', event),
  }

  // GUARDS

  /** These are referred to by name in `connectionMachine` (e.g. `cond: 'iHaveInvitation'`) */
  private readonly guards: Record<string, Condition> = {
    iHaveInvitation: (context) => {
      const result = context.invitee !== undefined
      return result
    },

    theyHaveInvitation: (context) => {
      const result = context.theirProofOfInvitation !== undefined
      return result
    },

    bothHaveInvitation: (...args) =>
      this.guards.iHaveInvitation(...args) && this.guards.theyHaveInvitation(...args),

    // TODO smells bad that this guard has the side effect of admitting the person
    invitationProofIsValid: (context) => {
      assert(context.team)
      assert(context.theirProofOfInvitation)

      try {
        context.team.admit(context.theirProofOfInvitation)
      } catch (e) {
        return false
      }
      return true
    },

    joinedTheRightTeam: (context, event) => {
      // Make sure my invitation exists on the signature chain of the team I'm about to join.
      // This check prevents an attack in which a fake team pretends to accept my invitation.
      const team = this.rehydrateTeam(context, event)
      return team.hasInvitation(this.myProofOfInvitation(context))
    },

    identityIsKnown: (context) => {
      if (context.team === undefined) return true
      const identityClaim = context.theirIdentityClaim!
      const userName = identityClaim.name
      return context.team.has(userName)
    },

    identityProofIsValid: (context, event) => {
      assert(context.team)
      const { team, challenge: originalChallenge } = context
      const identityProofMessage = event as ProveIdentityMessage
      const { challenge, proof } = identityProofMessage.payload

      if (!R.equals(originalChallenge, challenge)) return false
      const userName = challenge.name
      const publicKeys = team.members(userName).keys
      const validation = identity.verify(challenge, proof, publicKeys)
      return validation.isValid
    },

    headsAreEqual: (context, event) => {
      assert(context.team)
      const { head } = context.team.chain
      const { type, payload } = event as UpdateMessage | MissingLinksMessage | LocalUpdateMessage
      const theirHead =
        type === 'UPDATE' || type === 'MISSING_LINKS'
          ? payload.head // take from message
          : context.theirHead // use what we already have in context
      const result = head === theirHead
      return result
    },

    headsAreDifferent: (...args) => !this.guards.headsAreEqual(...args),

    dontHaveSessionkey: (context) => context.sessionKey === undefined,

    peerWasRemoved: (context) => {
      assert(context.team)
      assert(context.peer)
      return context.team.has(context.peer.userName) === false
    },
  }

  // helpers

  private logMessage = (direction: 'in' | 'out', message: ConnectionMessage, index: number) => {
    const arrow = direction === 'in' ? '<-' : '->'
    this.log(`${arrow} ${this.peerName} #${index} ${message.type} ${messageSummary(message)}`)
  }

  private rehydrateTeam = (context: ConnectionContext, event: ConnectionMessage) => {
    return new Team({
      source: (event as AcceptInvitationMessage).payload.chain,
      context: { user: context.user!, device: context.device },
    })
  }

  private myProofOfInvitation = (context: ConnectionContext) => {
    assert(context.invitationSeed)
    assert(context.invitee)
    return invitations.generateProof(context.invitationSeed, context.invitee)
  }
}

// for debugging

const messageSummary = (message: ConnectionMessage) =>
  // @ts-ignore
  message.payload?.head || message.payload?.message || ''

const isString = (state: any) => typeof state === 'string'

const stateSummary = (state: any = 'disconnected'): string =>
  isString(state)
    ? state === 'done'
      ? ''
      : state
    : Object.keys(state)
        .map((key) => `${key}:${stateSummary(state[key])}`)
        .filter((s) => s.length)
        .join(',')
