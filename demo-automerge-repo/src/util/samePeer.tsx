import { type PeerInfo } from '../peers'

export const samePeer = (a: PeerInfo, b: PeerInfo) =>
  a.user.userName === b.user.userName && a.device.name === b.device.name
