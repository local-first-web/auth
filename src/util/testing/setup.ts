import memoize from 'fast-memoize'
import * as teams from '/team'
import * as users from '/user'
import * as keysets from '/keyset'
import { bob, TestChannel, joinTestChannel } from '/util/testing'
import { arrayToMap, clone } from '/util/'
import { User } from '/user'
import { LocalUserContext } from '/context'
import { Connection, InitialContext } from '/connection'
import { redactDevice, DeviceType, getDeviceId, DeviceWithSecrets, PublicDevice } from '/device'
import { KeyType } from '/keyset'
import { ADMIN } from '/role'
import { Team } from '/team'
import { assert } from 'console'

type setupResult = Record<string, UserStuff>
const setupCache = {} as Record<string, setupResult>

/*
USAGE: 

```ts
const {alice, bob} = setup('alice', 'bob')
const {alice, bob, charlie} = setup('alice', 'bob', {name: 'charlie', member: false})
const {alice, bob, charlie, dwight} = setup('alice', 'bob', 'charlie', {name: 'dwight', admin: false})
```
alice.team.add('bob')

*/
export const setup = (_config: (TestUserSettings | string)[] = []) => {
  assert(_config.length > 0, `Can't do setup without any users`)

  const key = JSON.stringify(_config)
  // if (false) {
  if (key in setupCache) {
    return clone(setupCache[key])
  } else {
    // Coerce string userNames into TestUserSettings objects
    const config = _config.map(u => (typeof u === 'string' ? { user: u } : u))

    // Get a list of just user names
    const userNames = config.map(user => user.user)

    // Create users
    const testUsers: Record<string, User> = userNames
      .map(userName => users.create(userName))
      .reduce(arrayToMap('userName'), {})

    // Create team
    const founder = testUsers[userNames[0]] // e.g. Alice
    const founderContext = { user: founder } as LocalUserContext
    const sourceTeam = teams.create('Spies Я Us', founderContext)

    // Add members
    for (const { user: userName, admin = true, member = true } of config) {
      if (member && !sourceTeam.has(userName)) {
        sourceTeam.add(testUsers[userName], admin ? [ADMIN] : [])
      }
    }

    const makeUserStuff = ({ user: userName, member = true }: TestUserSettings) => {
      const user = testUsers[userName]
      const context = { user }
      const laptop = redactDevice(user.device)
      const team = member
        ? teams.load(JSON.stringify(sourceTeam.chain), context) // members get a copy of the source team
        : teams.create(userName, context) // non-members get a dummy empty placeholder team

      const makeDeviceStuff = (deviceName: string, type: DeviceType) => {
        const name = `${userName}'s ${deviceName}`
        const deviceInfo = { type, name: name, userName }
        const deviceKeys = keysets.create({ type: KeyType.DEVICE, name: getDeviceId(deviceInfo) })
        const device: DeviceWithSecrets = { ...deviceInfo, keys: deviceKeys }
        const publicDevice = redactDevice(device)
        const connectionContext = {
          user: { ...user, device },
          device: publicDevice,
        }
        return { device, connectionContext }
      }

      const userStuff = {
        userName,
        user,
        context,
        team,
        phone: makeDeviceStuff('phone', DeviceType.mobile),
        connectionContext: member ? { team, user, device: laptop } : { user, device: laptop },
        channel: {} as Record<string, TestChannel>,
        connection: {} as Record<string, Connection>,
      } as UserStuff

      return userStuff
    }

    const testUserStuff: Record<string, UserStuff> = config
      .map(makeUserStuff)
      .reduce(arrayToMap('userName'), {})

    setupCache[key] = clone(testUserStuff)
    return testUserStuff
  }
}

// HELPERS

/** Connects the two members and waits for them to be connected */
export const connect = async (a: UserStuff, b: UserStuff) => {
  const channel = new TestChannel()
  const join = joinTestChannel(channel)

  a.connection[b.userName] = join(a.connectionContext).start()
  b.connection[a.userName] = join(b.connectionContext).start()

  await connection(a, b)
}

/** Connects a (a member) with b (invited using the given seed). */
export const connectWithInvitation = async (a: UserStuff, b: UserStuff, seed: string) => {
  const join = joinTestChannel(a.channel[b.userName])
  b.connectionContext.invitationSeed = seed
  a.connection[b.userName] = join(a.connectionContext).start()
  b.connection[a.userName] = join(b.connectionContext).start()
  return connection(a, b).then(() => {
    // The connection now has the team object, so let's update our user stuff
    b.team = b.connection[a.userName].team!
  })
}

export const connectPhoneWithInvitation = async (a: UserStuff, seed: string) => {
  const join = joinTestChannel(new TestChannel())
  a.phone.connectionContext.invitationSeed = seed

  const laptop = join(a.connectionContext).start()
  const phone = join(a.phone.connectionContext).start()
  await all([laptop, phone], 'connected')
}

/** Passes if each of the given members is on the team, and knows every other member on the team */
export const expectEveryoneToKnowEveryone = (...members: UserStuff[]) => {
  for (const a of members)
    for (const b of members) //
      expect(a.team.has(b.userName)).toBe(true)
}

/** Disconnects the two members and waits for them to be disconnected */
export const disconnect = (a: UserStuff, b: UserStuff) =>
  Promise.all([
    disconnection(a, b),
    a.connection[b.userName].stop(),
    b.connection[a.userName].stop(),
  ])

// Promisified events

export const connection = async (a: UserStuff, b: UserStuff) => {
  const connections = [a.connection[b.userName], b.connection[a.userName]]

  // We're listening for a connection; if we're disconnected, throw an error
  connections.forEach(c =>
    c.on('disconnected', () => {
      throw new Error(c.error?.message || 'Diconnected')
    })
  )

  // ✅ They're both connected
  await all(connections, 'connected')

  // Remove the disconnect listeners so we don't throw errors later on
  connections.forEach(c => c.removeAllListeners())

  const sharedKey = connections[0].sessionKey
  connections.forEach(connection => {
    expect(connection.state).toEqual('connected')
    // ✅ They've converged on a shared secret key
    expect(connection.sessionKey).toEqual(sharedKey)
  })
}

export const updated = (a: UserStuff, b: UserStuff) => {
  const connections = [a.connection[b.userName], b.connection[a.userName]]
  return all(connections, 'updated')
}

export const disconnection = async (a: UserStuff, b: UserStuff, message?: string) => {
  const connections = [a.connection[b.userName], b.connection[a.userName]]

  // ✅ They're both disconnected
  await all(connections, 'disconnected')

  connections.forEach(connection => {
    expect(connection.state).toEqual('disconnected')
    // ✅ If we're checking for a message, it matches
    if (message !== undefined) expect(connection.error!.message).toContain(message)
  })
}

export const all = (connections: Connection[], event: string) =>
  Promise.all(
    connections.map(connection => {
      if (event === 'disconnect' && connection.state === 'disconnected') return true
      if (event === 'connected' && connection.state === 'connected') return true
      else return new Promise(resolve => connection.on(event, () => resolve()))
    })
  )

type TestUserSettings = {
  user: string
  admin?: boolean
  member?: boolean
}

interface UserStuff {
  userName: string
  user: User
  context: LocalUserContext
  phone: {
    device: DeviceWithSecrets
    connectionContext: InitialContext
  }
  team: Team
  connectionContext: InitialContext
  channel: Record<string, TestChannel>
  connection: Record<string, Connection>
}
