import memoize from 'fast-memoize'
import fs from 'fs'
import path from 'path'
import { InitialContext } from '/connection'
import { Connection } from '/connection/Connection'
import { LocalUserContext } from '/context'
import { DeviceInfo, DeviceType, DeviceWithSecrets, getDeviceId } from '/device'
import * as keysets from '/keyset'
import { KeyType } from '/keyset'
import { ADMIN } from '/role'
import * as teams from '/team'
import { Team } from '/team'
import * as users from '/user'
import * as devices from '/device'
import { User } from '/user'
import { arrayToMap, assert } from '/util'

/*
USAGE: 

  ```ts
  const {alice, bob} = setup(['alice', 'bob'])
  const {alice, bob, charlie} = setup(['alice', 'bob', {name: 'charlie', member: false}])
  const {alice, bob, charlie, dwight} = setup(['alice', 'bob', 'charlie', {name: 'dwight', admin: false}])

  alice.team.add('bob')
  ```

*/
export const setup = (_config: (TestUserSettings | string)[] = []) => {
  assert(_config.length > 0)

  // Coerce string userNames into TestUserSettings objects
  const config = _config.map((u) => (typeof u === 'string' ? { user: u } : u))

  // Get a list of just user names
  const userNames = config.map((user) => user.user)

  // Create users
  const testUsers: Record<string, User> = userNames
    .map((userName: string) =>
      retrieveAsset(userName, () => {
        const seed = userName // make these predictable
        return users.create(userName, seed)
      })
    )
    .reduce(arrayToMap('userName'), {})

  const testLaptops: Record<string, DeviceWithSecrets> = userNames
    .map((userName: string) =>
      retrieveAsset(`${userName}-laptop`, () => {
        const deviceName = `${userName}'s laptop`
        const seed = deviceName
        const deviceInfo: DeviceInfo = { userName, deviceName, type: DeviceType.laptop }
        return devices.create(deviceInfo, seed)
      })
    )
    .reduce(arrayToMap('userName'), {})

  // Create team
  const teamCacheKey = fileSystemSafe('team-' + JSON.stringify(config))
  const chain = retrieveAsset(teamCacheKey, () => {
    const founder = userNames[0] // e.g. alice
    const founderContext = { user: testUsers[founder], device: testLaptops[founder] }
    const teamSeed = 'seed123'
    const team = teams.create('Spies Я Us', founderContext, teamSeed)
    // Add members
    for (const { user: userName, admin = true, member = true } of config) {
      if (member && !team.has(userName)) {
        team.add(testUsers[userName], admin ? [ADMIN] : [])
      }
    }
    return team.chain
  })

  const makeUserStuff = ({ user: userName, member = true }: TestUserSettings) => {
    const user = testUsers[userName]
    const device = testLaptops[userName]
    const localContext = { user, device }
    const team = member
      ? teams.load(chain, localContext) // members get a copy of the source team
      : teams.create(userName, localContext) // non-members get a dummy empty placeholder team

    const makeDevice = (deviceName: string, type: DeviceType) => {
      const device = retrieveAsset(`${userName}-${deviceName}`, () => {
        const deviceInfo = { type, deviceName, userName } as DeviceInfo
        const deviceKeys = keysets.create({ type: KeyType.DEVICE, name: getDeviceId(deviceInfo) })
        return { ...deviceInfo, keys: deviceKeys } as DeviceWithSecrets
      })

      return device
    }

    const userStuff = {
      userName,
      user,
      team,
      device,
      localContext,
      phone: makeDevice('phone', DeviceType.mobile),
      connectionContext: member
        ? { team, user, device }
        : { invitee: { type: KeyType.MEMBER, name: userName }, invitationSeed: '', device },
      connection: {} as Record<string, Connection>,
      getState: (peer: string) => userStuff.connection[peer].state,
    } as UserStuff

    return userStuff
  }

  const testUserStuff: Record<string, UserStuff> = config
    .map(makeUserStuff)
    .reduce(arrayToMap('userName'), {})

  return testUserStuff
}

// HELPERS

export const tryToConnect = async (a: UserStuff, b: UserStuff) => {
  const aConnection = (a.connection[b.userName] = new Connection(a.connectionContext).start())
  const bConnection = (b.connection[a.userName] = new Connection(b.connectionContext).start())

  aConnection.pipe(bConnection).pipe(aConnection)
}

/** Connects the two members and waits for them to be connected */
export const connect = async (a: UserStuff, b: UserStuff) => {
  tryToConnect(a, b)
  return connection(a, b)
}

/** Connects a (a member) with b (invited using the given seed). */
export const connectWithInvitation = async (a: UserStuff, b: UserStuff, seed: string) => {
  b.connectionContext = {
    device: b.device,
    invitee: { type: KeyType.MEMBER, name: b.userName },
    invitationSeed: seed,
  }
  return connect(a, b).then(() => {
    // The connection now has the team object, so let's update our user stuff
    b.team = b.connection[a.userName].team!
  })
}

export const connectPhoneWithInvitation = async (a: UserStuff, seed: string) => {
  const phoneContext = {
    invitee: { type: KeyType.DEVICE, name: getDeviceId(a.phone) },
    invitationSeed: seed,
  } as InitialContext

  const laptop = new Connection(a.connectionContext).start()
  const phone = new Connection(phoneContext).start()

  laptop.pipe(phone).pipe(laptop)

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

// PROMISIFIED EVENTS

export const connection = async (a: UserStuff, b: UserStuff) => {
  const connections = [a.connection[b.userName], b.connection[a.userName]]

  // ✅ They're both connected
  await all(connections, 'connected')

  const sharedKey = connections[0].sessionKey
  connections.forEach((connection) => {
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
  const activeConnections = connections.filter((c) => c.state !== 'disconnected')

  // ✅ They're both disconnected
  await all(activeConnections, 'disconnected')

  activeConnections.forEach((connection) => {
    expect(connection.state).toEqual('disconnected')
    // ✅ If we're checking for a message, it matches
    if (message !== undefined) expect(connection.error!.message).toContain(message)
  })
}

export const all = (connections: Connection[], event: string) =>
  Promise.all(
    connections.map((connection) => {
      if (event === 'disconnect' && connection.state === 'disconnected') return true
      if (event === 'connected' && connection.state === 'connected') return true
      else return new Promise((resolve) => connection.on(event, () => resolve(true)))
    })
  )

// TEST ASSETS

const parseAssetFile = memoize((fileName: string) =>
  JSON.parse(fs.readFileSync(fileName).toString())
)

const retrieveAsset = <T>(fileName: string, fn: () => T): T => {
  const filePath = path.join(__dirname, `./assets/${fileName}.json`)
  if (fs.existsSync(filePath)) return parseAssetFile(filePath) as T
  const result: any = fn()
  fs.writeFileSync(filePath, JSON.stringify(result))
  return result as T
}

const fileSystemSafe = (s: string) =>
  s
    .replace(/user/gi, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-/i, '')
    .replace(/-$/i, '')
    .toLowerCase()

// TYPES

type TestUserSettings = {
  user: string
  admin?: boolean
  member?: boolean
}

interface UserStuff {
  userName: string
  user: User
  team: Team
  device: DeviceWithSecrets
  phone: DeviceWithSecrets
  localContext: LocalUserContext
  connectionContext: InitialContext
  connection: Record<string, Connection>
  getState: (peer: string) => any
}
