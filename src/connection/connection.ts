import { EventEmitter } from 'events'
import { createMachine, interpret } from 'xstate'
import { machineConfig } from './machineConfig'
import { deriveSharedKey } from '/connection/deriveSharedKey'
import { Action, Condition, ConnectionParams, SendFunction } from '/connection/types'
import { asymmetric } from '@herbcaudill/crypto'
import * as identity from '/identity'
import { KeyType, randomKey } from '/keyset'
import {
  AcceptIdentityMessage,
  ChallengeIdentityMessage,
  ClaimIdentityMessage,
  ProveIdentityMessage,
} from '/message'
import { Team } from '/team'
import { User } from '/user'

const { MEMBER } = KeyType

/** A `ConnectionService` wraps a state machine (using [XState](https://xstate.js.org/docs/)) that
 * implements the connection protocol.  */
export class ConnectionService extends EventEmitter {
  private sendMessage: SendFunction
  private team: Team
  private user: User

  constructor(params: ConnectionParams) {
    super()
    this.sendMessage = params.sendMessage
    this.team = params.team
    this.user = params.user
  }

  /**
   * @returns a running instance of an XState state machine
   */
  public start = () => {
    // define state machine
    const machineDefinition = createMachine(machineConfig, {
      actions: {
        claim: this.claim,
        challenge: this.challenge,
        prove: this.prove,
        accept: this.accept,
        saveSeed: this.saveSeed,
        onConnected: this.onConnected,
        deriveSecretKey: this.deriveSecretKey,
      },
      guards: {
        identityIsKnown: this.identityIsKnown,
        proofIsValid: this.proofIsValid,
      },
    })

    // provide our starting context to the state machine
    const machine = machineDefinition.withContext({
      team: this.team,
      user: this.user,
    })

    // instantiate the machine
    const service = interpret(machine)

    // start the instance
    return service.start()
  }

  // public connect = async () => {
  //   this.start()
  //   return new Promise((resolve, reject) => {
  //     this.on('connected', () => resolve(this))
  //     // this.on('error', something something)
  //   })
  // }

  public send = () => {}

  public receive = () => {}

  // ACTIONS

  private claim: Action = context => {
    const { user } = context
    // generate claim
    const claimMessage = identity.claim({ type: MEMBER, name: user.userName })

    this.sendMessage(claimMessage)
  }

  private challenge: Action = (context, event) => {
    const claimMessage = event as ClaimIdentityMessage

    // store peer on context
    context.peer = context.team.members(claimMessage.payload.name)

    // generate challenge
    const challengeMessage = identity.challenge(claimMessage)

    // store challenge in context, to check against later
    context.challenge = challengeMessage

    this.sendMessage(challengeMessage)
  }

  private prove: Action = (context, event) => {
    const challenge = event as ChallengeIdentityMessage

    // generate proof
    const proofMessage = identity.prove(challenge, context.user.keys)

    this.sendMessage(proofMessage)
  }

  private accept: Action = context => {
    // generate a seed that will be combined with the peer's seed to create a symmetric encryption key
    const seed = randomKey()
    // save it in context so we can retrieve it later
    context.seed = seed

    const peerKeys = context.peer!.keys
    const userKeys = context.user.keys
    const acceptanceMessage = identity.accept({ seed, peerKeys, userKeys })

    this.sendMessage(acceptanceMessage)
  }

  private deriveSecretKey: Action = (context, event) => {
    const userKeys = context.user.keys
    const peerKeys = context.peer!.keys

    // we saved our seed in context
    const userSeed = context.seed!
    // the peer's seed is in context but is encrypted; decrypt it
    const peerSeed = asymmetric.decrypt({
      cipher: context.encryptedPeerSeed!,
      senderPublicKey: peerKeys.encryption,
      recipientSecretKey: userKeys.encryption.secretKey,
    })

    context.secretKey = deriveSharedKey(userSeed, peerSeed)
  }

  private onConnected: Action = (context, event) => {
    this.emit('connected')
  }

  private saveSeed: Action = (context, event) => {
    // save seed
    const acceptanceMessage = event as AcceptIdentityMessage
    context.encryptedPeerSeed = acceptanceMessage.payload.encryptedSeed
  }

  // GUARDS!! GUARDS!!

  private identityIsKnown: Condition = (context, event) => {
    const claim = (event as ClaimIdentityMessage).payload
    const userName = claim.name
    const { team } = context
    return team.has(userName)
  }

  private proofIsValid: Condition = (context, event) => {
    const { team, challenge } = context
    const proofMessage = event as ProveIdentityMessage
    const userName = challenge!.payload.name!
    const publicKeys = team.members(userName).keys
    const validation = identity.verify(challenge!, proofMessage, publicKeys)
    return validation.isValid
  }
}
