import { Connection, InitialContext } from '@/connection'
import { LocalUserContext } from '@/context'
import * as devices from '@/device'
import { DeviceWithSecrets, getDeviceId } from '@/device'
import { ADMIN } from '@/role'
import * as teams from '@/team'
import { Team, TeamContext } from '@/team'
import { arrayToMap, assert, KeyType } from '@/util'
import { createUser, UserWithSecrets } from 'crdx'

export type SetupConfig = ((TestUserSettings | string)[] | TestUserSettings | string)[]

// ignore file coverage

/**
Usage: 

```ts
const {alice, bob} = setup(['alice', 'bob'])
const {alice, bob, charlie} = setup(['alice', 'bob', {user: 'charlie', member: false}])
const {alice, bob, charlie, dwight} = setup(['alice', 'bob', 'charlie', {user: 'dwight', admin: false}])

alice.team.add('bob')
```
*/
export const setup = (..._config: SetupConfig) => {
  assert(_config.length > 0)

  // accept `setup(['a', 'b'])` or `setup('a','b')`
  if (Array.isArray(_config[0])) _config = _config[0] as (TestUserSettings | string)[]

  // Coerce string userIds into TestUserSettings objects
  const config = _config.map(u => (typeof u === 'string' ? { user: u } : u)) as TestUserSettings[]

  // Get a list of just user ids
  const userIds = config.map(user => user.user)

  // Create users
  const testUsers: Record<string, UserWithSecrets> = userIds
    .map((userId: string) => {
      const randomSeed = userId // make these predictable
      const userName = userId.replace(/^(.)/, (_, c) => c.toUpperCase()) + ' McUser'
      return createUser(userName, userId, randomSeed)
    })
    .reduce(arrayToMap('userId'), {})

  const makeDevice = (userId: string, deviceName: string) => {
    const key = `${userId}-${deviceName}`
    const randomSeed = key
    const device = devices.createDevice(userId, deviceName, randomSeed)
    return device
  }

  const laptops: Record<string, DeviceWithSecrets> = userIds
    .map((userId: string) => makeDevice(userId, 'laptop'))
    .reduce(arrayToMap('userId'), {})

  const phones: Record<string, DeviceWithSecrets> = userIds
    .map((userId: string) => makeDevice(userId, 'phone'))
    .reduce(arrayToMap('userId'), {})

  // Create team
  const founder = userIds[0] // e.g. alice

  const founderContext = { user: testUsers[founder], device: laptops[founder] }
  const teamName = 'Spies Я Us'
  const randomSeed = teamName
  const team = teams.createTeam(teamName, founderContext, randomSeed)
  const teamKeys = team.teamKeys()

  // Add members
  for (const { user: userId, admin = true, member = true } of config) {
    if (member && !team.has(userId)) {
      const user = testUsers[userId]
      const roles = admin ? [ADMIN] : []
      const device = devices.redactDevice(laptops[userId])
      team.addForTesting(user, roles, device)
    }
  }
  const graph = team.graph

  const makeUserStuff = ({ user: userId, member = true }: TestUserSettings): UserStuff => {
    const user = testUsers[userId]
    const randomSeed = userId
    const device = laptops[userId]
    const phone = phones[userId]

    const localContext = { user, device }
    const graphContext = { deviceId: getDeviceId(device) }
    const team = member
      ? teams.load(graph, localContext, teamKeys) // members get a copy of the source team
      : teams.createTeam(userId, localContext, randomSeed) // non-members get a dummy empty placeholder team

    const context = (
      member
        ? { user, device, team }
        : {
            user,
            device,
            invitee: { type: KeyType.USER, name: userId },
            invitationSeed: '',
          }
    ) as InitialContext

    const connection = {} as Record<string, Connection>
    const getState = (peer: string) => connection[peer].state

    return {
      userId,
      user,
      team,
      device,
      localContext,
      graphContext,
      phone,
      connectionContext: context,
      connection,
      getState,
    }
  }

  const testUserStuff: Record<string, UserStuff> = config
    .map(makeUserStuff)
    .reduce(arrayToMap('userId'), {})

  return testUserStuff
}

// TYPES

export type TestUserSettings = {
  user: string
  admin?: boolean
  member?: boolean
}

export interface UserStuff {
  userId: string
  user: UserWithSecrets
  team: Team
  device: DeviceWithSecrets
  phone: DeviceWithSecrets
  localContext: LocalUserContext
  graphContext: TeamContext
  connectionContext: InitialContext
  connection: Record<string, Connection>
  getState: (peer: string) => any
}
