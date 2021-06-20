import util from 'util'
import { TeamAction } from '@/chain'
import { generateMessage, initSyncState, receiveMessage, SyncPayload, SyncState } from '@/sync'
import { Team } from '@/team'
import { debug, truncateHashes } from '@/util'
import { setup, UserStuff } from '@/util/testing'

const log = debug('lf:auth:tests')

// Simulates a peer-to-peer network
export class Network {
  peers: Record<string, Peer>
  queue: any[]
  constructor() {
    this.peers = {}
    this.queue = []
  }

  registerPeer(peer: Peer) {
    this.peers[peer.userName] = peer
    peer.network = this
  }

  // Establishes a bidirectionial connection between two peers
  connect(a: Peer, b: Peer) {
    this.registerPeer(a)
    this.registerPeer(b)
    a.connect(b.userName)
    b.connect(a.userName)
  }

  // Enqueues one message to be sent from fromPeer to toPeer
  sendMessage(from: string, to: string, body: SyncPayload<TeamAction>) {
    log('network: sending %o', { from, to, body })
    this.queue.push({ from, to, body })
  }

  // Runs the protocol until all peers run out of things to say
  deliverAll() {
    let messageCount = 0
    const peerCount = Object.keys(this.peers).length
    const maxMessages = 5 ** peerCount // rough estimate

    const delivered = [] as any[]

    while (this.queue.length) {
      const { to, from, body } = this.queue.shift()
      delivered.push({ to, from, body })
      const peer = this.peers[to]
      log('network: receiving %o', { from, body })
      peer.receiveMessage(from, body)

      // catch failure to converge
      if (messageCount++ > maxMessages) {
        const recentlyDelivered = delivered.slice(delivered.length - 10)
        console.log(logMessages(recentlyDelivered))
        throw truncateStack(new Error('loop detected'))
      }
    }
    // console.log(`${Object.keys(this.peers).length} peers, required ${messageCount} messages`)
    return delivered
  }
}

// One peer, which may be connected to any number of other peers
class Peer {
  syncStates: Record<string, SyncState>
  userName: string
  team: Team
  network: Network

  constructor(userName: string, team: Team, network: Network) {
    this.userName = userName
    this.team = team
    this.network = network
    this.syncStates = {}
  }

  // Called by Network.connect when a connection is established with a remote peer
  connect(userName: string) {
    this.syncStates[userName] = initSyncState()
  }

  // Generates and enqueues messages to all peers we're connected to (unless there is nothing to send)
  sync() {
    for (const [userName, prevSyncState] of Object.entries(this.syncStates)) {
      const [syncState, message] = generateMessage(this.team.chain, prevSyncState)
      this.syncStates[userName] = syncState
      if (message !== undefined) this.network.sendMessage(this.userName, userName, message)
    }
  }

  // Called by Network when we receive a message from another peer
  receiveMessage(sender: string, message: SyncPayload<TeamAction>) {
    const [chain, syncState] = receiveMessage(this.team.chain, this.syncStates[sender], message)
    this.team = this.team.merge(chain)
    this.syncStates[sender] = syncState
    this.sync()
  }
}

function truncateStack(err: Error, lines = 5) {
  err.stack = err.stack!.split('\n').slice(1, lines).join('\n') // truncate repetitive stack
  return err
}

export interface UserStuffWithPeer extends UserStuff {
  peer: Peer
}

export const setupWithNetwork = (
  ...config: any
): [users: Record<string, UserStuffWithPeer>, network: Network] => {
  const users = setup(...config) as Record<string, UserStuffWithPeer>

  const network = new Network()

  for (const userName in users) {
    const user = users[userName]
    user.peer = new Peer(userName, user.team, network)
  }

  return [users, network]
}

export const logMessages = (msgs: { to: string; from: string; body: SyncPayload<TeamAction> }[]) =>
  msgs.forEach(m =>
    console.log(
      `from ${m.from} to ${m.to}: ${truncateHashes(
        util.inspect(m.body, { depth: 1, colors: true })
      )}`
    )
  )
