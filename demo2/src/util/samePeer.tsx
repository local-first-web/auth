import { PeerInfo } from '../peers'

export const samePeer = (a: PeerInfo, b: PeerInfo) =>
  a.user.name === b.user.name && a.device.name === b.device.name
