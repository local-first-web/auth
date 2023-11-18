import { type TeamState } from 'team/types.js'
import { assert } from 'util/index.js'
import { server } from './server.js'
import { hasServer } from './hasServer.js'
import { cast } from 'server/cast.js'

export const hasDeviceById = (
  state: TeamState,
  deviceId: string,
  options = { includeRemoved: false }
) => {
  return getDeviceById(state, deviceId, options) !== undefined
}

export const deviceById = (
  state: TeamState,
  deviceId: string,
  options = { includeRemoved: false }
) => {
  const device = getDeviceById(state, deviceId, options)
  assert(device, `Device ${deviceId} not found`)
  return device
}

const getDeviceById = (state: TeamState, deviceId: string, options = { includeRemoved: false }) => {
  if (hasServer(state, deviceId)) {
    return cast.toDevice(server(state, deviceId))
  }
  const allDevices = state.members.flatMap(m => m.devices ?? [])
  return (
    allDevices.find(d => d.deviceId === deviceId) ??
    (options.includeRemoved ? state.removedDevices.find(d => d.deviceId === deviceId) : undefined)
  )
}
