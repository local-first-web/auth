import { cache } from './cache'
import { InitialContext, Connection } from '@/connection'
import { LocalUserContext } from '@/context'
import * as devices from '@/device'
import { DeviceWithSecrets } from '@/device'
import { KeyType } from '@/keyset'
import { ADMIN } from '@/role'
import * as teams from '@/team'
import { Team } from '@/team'
import * as users from '@/user'
import { User } from '@/user'
import { arrayToMap, assert } from '@/util'

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
export const setup = (
  ..._config: ((TestUserSettings | string)[] | TestUserSettings | string)[]
) => {
  assert(_config.length > 0)

  // accept `setup(['a', 'b'])` or `setup('a','b')`
  if (Array.isArray(_config[0])) _config = _config[0] as (TestUserSettings | string)[]

  // Coerce string userNames into TestUserSettings objects
  const config = _config.map(u => (typeof u === 'string' ? { user: u } : u)) as TestUserSettings[]

  // Get a list of just user names
  const userNames = config.map(user => user.user)

  const cacheKey = 'setup-' + JSON.stringify(config)
  const { testUsers, laptops, phones, chain } = cache(cacheKey, () => {
    // Create users
    const testUsers: Record<string, User> = userNames
      .map((userName: string) => {
        const randomSeed = userName // make these predictable
        return users.create(userName, randomSeed)
      })
      .reduce(arrayToMap('userName'), {})

    const makeDevice = (userName: string, deviceName: string) => {
      const key = `${userName}-${deviceName}`
      const randomSeed = key
      const device = devices.create(userName, deviceName, randomSeed)
      return device
    }

    const laptops: Record<string, DeviceWithSecrets> = userNames
      .map((userName: string) => makeDevice(userName, 'laptop'))
      .reduce(arrayToMap('userName'), {})

    const phones: Record<string, DeviceWithSecrets> = userNames
      .map((userName: string) => makeDevice(userName, 'phone'))
      .reduce(arrayToMap('userName'), {})

    // Create team
    const founder = userNames[0] // e.g. alice
    const founderContext = { user: testUsers[founder], device: laptops[founder] }
    const teamName = 'Spies Я Us'
    const randomSeed = teamName
    const team = teams.create(teamName, founderContext, randomSeed)

    // Add members
    for (const { user: userName, admin = true, member = true } of config) {
      if (member && !team.has(userName)) {
        const user = testUsers[userName]
        const roles = admin ? [ADMIN] : []
        const device = devices.redactDevice(laptops[userName])
        team.add(user, roles, device)
      }
    }
    const chain = team.chain

    return { testUsers, laptops, phones, chain }
  })

  const makeUserStuff = ({ user: userName, member = true }: TestUserSettings): UserStuff => {
    const user = testUsers[userName]
    const randomSeed = userName
    const device = laptops[userName]
    const phone = phones[userName]
    const localContext = { user, device }
    const team = member
      ? teams.load(chain, localContext) // members get a copy of the source team
      : teams.create(userName, localContext, randomSeed) // non-members get a dummy empty placeholder team
    const connectionContext = (member
      ? { user, device, team }
      : {
          user,
          device,
          invitee: { type: KeyType.MEMBER, name: userName },
          invitationSeed: '',
        }) as InitialContext
    const connection = {} as Record<string, Connection>
    const getState = (peer: string) => connection[peer].state

    return {
      userName,
      user,
      team,
      device,
      localContext,
      phone,
      context: connectionContext,
      connection,
      getState,
    }
  }

  const testUserStuff: Record<string, UserStuff> = config
    .map(makeUserStuff)
    .reduce(arrayToMap('userName'), {})

  return testUserStuff
}

// TYPES

type TestUserSettings = {
  user: string
  admin?: boolean
  member?: boolean
}

export interface UserStuff {
  userName: string
  user: User
  team: Team
  device: DeviceWithSecrets
  phone: DeviceWithSecrets
  localContext: LocalUserContext
  context: InitialContext
  connection: Record<string, Connection>
  getState: (peer: string) => any
}
