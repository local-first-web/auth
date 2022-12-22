import { arrayToMap } from './util/arrayToMap'

export const devices = {
  laptop: { name: 'laptop', emoji: '💻' },
  phone: { name: 'phone', emoji: '📱' },
} as Record<string, DeviceInfo>

export const users = {
  Alice: { userName: 'Alice', userId: 'alice-111', emoji: '👩🏾' },
  Bob: { userName: 'Bob', userId: 'bob-222', emoji: '👨🏻‍🦲' },
  Charlie: { userName: 'Charlie', userId: 'charlie-333', emoji: '👳🏽‍♂️' },
  Dwight: { userName: 'Dwight', userId: 'dwight-444', emoji: '👴' },
  Eve: { userName: 'Eve', userId: 'eve-555', emoji: '🦹‍♀️' },
} as Record<string, UserInfo>

const peerArray = Object.values(users).flatMap(user =>
  Object.values(devices).map(
    device =>
      ({
        user,
        device,
        id: `${user.userName}:${device.name}`,
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
  userId: string
  userName: string
  emoji: string
}
