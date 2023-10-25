// ignore file coverage
import {
  generateMessage,
  initSyncState,
  type KeysetWithSecrets,
  receiveMessage,
  type SyncMessage,
  type SyncState,
} from '@localfirst/crdx'
import { type UserStuff } from './setup.js'
import { type Team } from '@/team.js'

// Simulates a peer-to-peer network
export class Network {
  peers: Record<string, Peer>
  queue: any[]
  teamKeys: KeysetWithSecrets

  constructor(teamKeys: KeysetWithSecrets) {
    this.peers = {}
    this.queue = []
    this.teamKeys = teamKeys
  }

  registerPeer(peer: Peer) {
    this.peers[peer.userName] = peer
  }

  // Establishes a bidirectionial connection between two peers
  connect(a: Peer, b: Peer) {
    this.registerPeer(a)
    this.registerPeer(b)
    a.connect(b.userName)
    b.connect(a.userName)
  }

  // Enqueues one message to be sent from fromPeer to toPeer
  sendMessage(from: string, to: string, body: SyncMessage) {
    this.queue.push({ from, to, body })
  }

  // Runs the protocol until all peers run out of things to say
  deliverAll(messageMutator: MessageMutator = message => message) {
    let messageCount = 0
    const peerCount = Object.keys(this.peers).length
    const maxMessages = 10 ** peerCount // Rough estimate

    const delivered = [] as NetworkMessage[]

    while (this.queue.length > 0) {
      const originalMessage = this.queue.shift()

      const message = messageMutator(originalMessage)
      const { to, from, body } = message

      this.peers[to].receiveMessage(from, body, this.teamKeys)

      // Log the message for the results of this delivery run
      delivered.push(message)

      // Catch failure to converge
      if (messageCount++ > maxMessages) {
        throw truncateStack(new Error('loop detected'))
      }
    }

    return delivered
  }
}

// One peer, which may be connected to any number of other peers
class Peer {
  syncStates: Record<string, SyncState>
  constructor(
    public userName: string,
    public team: Team,
    public network: Network
  ) {
    this.syncStates = {}
  }

  // Called by Network.connect when a connection is established with a remote peer
  connect(userName: string) {
    this.syncStates[userName] = initSyncState()
  }

  // Generates and enqueues messages to all peers we're connected to (unless there is nothing to send)
  sync() {
    for (const [userName, previousSyncState] of Object.entries(
      this.syncStates
    )) {
      const [syncState, message] = generateMessage(
        this.team.graph,
        previousSyncState
      )
      this.syncStates[userName] = syncState
      if (message) {
        this.network.sendMessage(this.userName, userName, message)
      }
    }
  }

  // Called by Network when we receive a message from another peer
  receiveMessage(
    sender: string,
    message: SyncMessage,
    teamKeys: KeysetWithSecrets
  ) {
    const [chain, syncState] = receiveMessage(
      this.team.graph,
      this.syncStates[sender],
      message,
      teamKeys
    )
    this.team = this.team.merge(chain)
    this.syncStates[sender] = syncState
    this.sync()
  }
}

function truncateStack(error: Error, lines = 5) {
  error.stack = error.stack //
    .split('\n')
    .slice(1, lines)
    .join('\n') // Truncate repetitive stack
  return error
}

// Export const setupWithNetwork = (...config: any): [Record<string, UserStuffWithPeer>, Network] => {
//   const users = setup(...config) as Record<string, UserStuffWithPeer>

//   const network = new Network(teamKeys)

//   for (const userName in users) {
//     const user = users[userName]
//     user.peer = new Peer(userName, user.team, network)
//   }

//   return [users, network]
// }

export type UserStuffWithPeer = {
  peer: Peer
} & UserStuff

export type NetworkMessage = {
  to: string
  from: string
  body: SyncMessage
}

export type MessageMutator = (message: NetworkMessage) => NetworkMessage
