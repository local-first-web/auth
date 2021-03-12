import { arrayToMap } from './util/arrayToMap'
import { DeviceInfo, devices as deviceMap } from './devices'
import { UserInfo, users as userMap } from './users'

const users = Object.values(userMap)
const devices = Object.values(deviceMap)

const peerArray = devices.flatMap(device =>
  users.map(
    user =>
      ({
        user,
        device,
        id: `${user.name}:${device.name}`,
        show: false,
      } as PeerInfo)
  )
)

export const peers = peerArray.reduce(arrayToMap('id'), {}) as PeerMap

export interface PeerInfo {
  id: string
  user: UserInfo
  device: DeviceInfo
  show: boolean
}

export type PeerMap = Record<string, PeerInfo>
