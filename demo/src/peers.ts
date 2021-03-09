import { arrayToMap } from './util/arrayToMap'
import { DeviceInfo, devices as deviceMap } from './devices'
import { UserInfo, users as userMap } from './users'
import { Team } from '@localfirst/auth'

const users = Object.values(userMap)
const devices = Object.values(deviceMap)

const peerArray = devices.flatMap(device =>
  users.map(
    user =>
      ({
        user,
        device,
        id: `${user.name}:${device.name}`,
        added: false,
      } as PeerInfo)
  )
)

export const peers = peerArray.reduce(arrayToMap('id'), {}) as PeerMap

export interface PeerInfo {
  user: UserInfo
  device: DeviceInfo
  id: string
  added: boolean
  team?: Team
}

export type PeerMap = Record<string, PeerInfo>
