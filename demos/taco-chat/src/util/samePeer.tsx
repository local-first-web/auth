import { type PeerInfo } from '../peers.js'

export const samePeer = (a: PeerInfo, b: PeerInfo) =>
  a.user.userName === b.user.userName && a.device.name === b.device.name
