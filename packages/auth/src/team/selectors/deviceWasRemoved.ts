import { type TeamState } from 'team/types.js'
import { hasDevice } from './device.js'

export const deviceWasRemoved = (state: TeamState, deviceId: string) => {
  if (!hasDevice(state, deviceId, { includeRemoved: true })) return false
  // throw new Error(`Device ${deviceId} does not exist`)
  return state.removedDevices.some(d => d.keys.name === deviceId)
}
