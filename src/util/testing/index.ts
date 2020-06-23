import { Client, LocalUserContext } from '/context'
import { DeviceType, DeviceWithSecrets } from '/device'
import * as keyset from '/keyset'
import { KeyType } from '/keyset'
import { Role } from '/role'
import * as teams from '/team'
import { Team } from '/team'
import * as user from '/user'

// A simple little storage emulator

export const storage = {
  contents: undefined as string | undefined,
  save: (team: Team) => {
    storage.contents = team.save()
  },
  load: (context: LocalUserContext) => {
    if (storage.contents === undefined) throw new Error('need to save before you can load')
    return teams.load(JSON.parse(storage.contents), context)
  },
}

// test assets

export const makeUser = (userName: string) => user.create(userName, makeDevice(userName))

export const makeDevice = (userName: string): DeviceWithSecrets => {
  const deviceName = `${userName}'s laptop`
  return {
    name: deviceName,
    userName,
    type: DeviceType.laptop,
    keys: keyset.create({ type: KeyType.DEVICE, name: deviceName }),
  }
}

export const alice = makeUser('alice')
export const bob = makeUser('bob')
export const charlie = makeUser('charlie')
export const eve = makeUser('eve')

export const alicesLaptop = alice.device
export const bobsLaptop = bob.device
export const charliesLaptop = charlie.device
export const evesLaptop = eve.device

export const MANAGERS = 'managers'
export const managers: Role = { roleName: MANAGERS }

export const client: Client = {
  name: 'test',
  version: '0',
}

export const alicesContext: LocalUserContext = { user: alice, client }
export const bobsContext: LocalUserContext = { user: bob, client }
export const charliesContext: LocalUserContext = { user: charlie, client }

export const defaultContext = alicesContext

export const newTeam = () => teams.create('Spies Я Us', defaultContext)
export const newTeamChain = JSON.parse(newTeam().save())
