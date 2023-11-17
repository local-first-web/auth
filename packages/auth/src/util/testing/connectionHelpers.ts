// ignore file coverage
import { type Connection, type ConnectionEvents } from 'connection/index.js'
import {
  type InviteeDeviceInitialContext,
  type InviteeMemberInitialContext,
} from 'connection/types.js'
import type { EventEmitter } from 'eventemitter3'
import { expect } from 'vitest'
import { TestChannel } from './TestChannel.js'
import { joinTestChannel } from './joinTestChannel.js'
import { type UserStuff } from './setup.js'

// HELPERS

export const tryToConnect = async (a: UserStuff, b: UserStuff) => {
  const join = joinTestChannel(new TestChannel())

  a.connection[b.deviceId] = join(a.connectionContext).start()
  b.connection[a.deviceId] = join(b.connectionContext).start()
}

/** Connects the two members and waits for them to be connected */
export const connect = async (a: UserStuff, b: UserStuff) => {
  void tryToConnect(a, b)
  await connection(a, b)
}

/** Connects a (a member) with b (invited using the given seed). */
export const connectWithInvitation = async (a: UserStuff, b: UserStuff, seed: string) => {
  b.connectionContext = {
    user: b.user,
    device: b.device,
    invitationSeed: seed,
  } as InviteeMemberInitialContext

  return connect(a, b).then(() => {
    // The connection now has the team object, so let's update our user stuff
    b.team = b.connection[a.deviceId].team!
  })
}

export const connectPhoneWithInvitation = async (user: UserStuff, seed: string) => {
  const phoneContext: InviteeDeviceInitialContext = {
    userName: user.user.userName,
    device: user.phone!,
    invitationSeed: seed,
  }

  const join = joinTestChannel(new TestChannel())

  const laptopConnection = join(user.connectionContext).start()
  const phoneConnection = join(phoneContext).start()

  await all([laptopConnection, phoneConnection], 'connected')
  user.team = laptopConnection.team!
  user.connection = { [user.phoneStuff!.deviceId]: phoneConnection }
  user.phoneStuff!.team = phoneConnection.team!
  user.phoneStuff!.connection = { [user.deviceId]: laptopConnection }
}

/** Passes if each of the given members is on the team, and knows every other member on the team */
export const expectEveryoneToKnowEveryone = (...members: UserStuff[]) => {
  for (const a of members) {
    for (const b of members) {
      if (!a.team.has(b.userId)) {
        throw new Error(`${a.userId} does not have ${b.userId} on their team`)
      }
    }
  }
}

/** Disconnects the two members and waits for them to be disconnected */
export const disconnect = async (a: UserStuff, b: UserStuff) =>
  Promise.all([
    disconnection(a, b),
    a.connection[b.deviceId].stop(),
    b.connection[a.deviceId].stop(),
  ])

// PROMISIFIED EVENTS
export const connection = async (a: UserStuff, b: UserStuff) => {
  const connections = [a.connection[b.deviceId], b.connection[a.deviceId]]

  // ✅ They're both connected
  await all(connections, 'connected')

  const sharedKey = connections[0].sessionKey
  for (const connection of connections) {
    expect(connection.state).toEqual('connected')
    // ✅ They've converged on a shared secret key
    expect(connection.sessionKey).toEqual(sharedKey)
  }
}

export const updated = async (a: UserStuff, b: UserStuff) => {
  const connections = [a.connection[b.deviceId], b.connection[a.deviceId]]
  return all(connections, 'updated')
}

export const anyUpdated = async (a: UserStuff, b: UserStuff) => {
  const connections = [a.connection[b.deviceId], b.connection[a.deviceId]]
  return any(connections, 'updated')
}

export const anyDisconnected = async (a: UserStuff, b: UserStuff) => {
  const connections = [a.connection[b.deviceId], b.connection[a.deviceId]]
  return any(connections, 'disconnected')
}

export const disconnection = async (a: UserStuff, b: UserStuff, message?: string) => {
  const connections = [a.connection[b.deviceId], b.connection[a.deviceId]]
  const activeConnections = connections.filter(c => c.state !== 'disconnected')

  // ✅ They're both disconnected
  await all(activeConnections, 'disconnected')

  for (const connection of activeConnections) {
    expect(connection.state).toEqual('disconnected')
    // ✅ If we're checking for a message, it matches
    if (message !== undefined) {
      expect(connection.error!.message).toContain(message)
    }
  }
}

export const all = async (
  connections: Connection[],
  event: EventEmitter.EventNames<ConnectionEvents>
) =>
  Promise.all(
    connections.map(async connection => {
      if (event === 'disconnected' && connection.state === 'disconnected') {
        return true
      }

      if (event === 'connected' && connection.state === 'connected') {
        return true
      }

      return new Promise(resolve => {
        connection.on(event, () => {
          resolve(true)
        })
      })
    })
  )

export const any = async (
  connections: Connection[],
  event: EventEmitter.EventNames<ConnectionEvents>
) =>
  Promise.any(
    connections.map(async connection => {
      if (event === 'disconnected' && connection.state === 'disconnected') {
        return true
      }

      if (event === 'connected' && connection.state === 'connected') {
        return true
      }

      return new Promise(resolve => {
        connection.on(event, () => {
          resolve(true)
        })
      })
    })
  )
