import { KeysetWithSecrets, createKeyring } from '@localfirst/crdx'
import { TeamState } from 'team/types'
import { KeyType } from 'util/types.js'
import { keyMap } from './keyMap.js'

const { TEAM } = KeyType

export const teamKeyring = (state: TeamState, keys: KeysetWithSecrets) => {
  const allTeamKeys = keyMap(state, keys)[TEAM][TEAM]
  return createKeyring(allTeamKeys)
}
