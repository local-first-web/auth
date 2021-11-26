import { arrayToMap } from './util/arrayToMap'

export const devices = {
  laptop: { name: 'laptop', emoji: '💻' },
  phone: { name: 'phone', emoji: '📱' },
} as Record<string, DeviceInfo>

export const users = {
  Alice: { name: 'Alice', emoji: '👩🏾' },
  Bob: { name: 'Bob', emoji: '👨🏻‍🦲' },
  Charlie: { name: 'Charlie', emoji: '👳🏽‍♂️' },
  Dwight: { name: 'Dwight', emoji: '👴' },
  Eve: { name: 'Eve', emoji: '🦹‍♀️' },
} as Record<string, UserInfo>

const peerArray = Object.values(devices).flatMap(device =>
  Object.values(users).map(
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

export type DeviceInfo = {
  name: string
  emoji: string
}

export type UserInfo = {
  name: string
  emoji: string
}
