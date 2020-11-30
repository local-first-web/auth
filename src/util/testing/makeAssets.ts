import { Client, LocalUserContext } from '/context'
import { Role } from '/role'
import * as team from '/team'
import * as user from '/user'
// test assets

export const alice = user.create('alice')
export const bob = user.create('bob')
export const charlie = user.create('charlie')
export const dwight = user.create('dwight')
export const eve = user.create('eve')

export const alicesLaptop = alice.device
export const bobsLaptop = bob.device
export const charliesLaptop = charlie.device
export const dwightsLaptop = dwight.device
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
export const dwightsContext: LocalUserContext = { user: dwight, client }
export const evesContext: LocalUserContext = { user: eve, client }

export const defaultContext = alicesContext

export const newTeam = () => team.create('Spies Я Us', defaultContext)
export const newTeamChain = JSON.parse(newTeam().save())
