import { type TeamState } from 'team/types.js'
import { assert } from 'util/index.js'
import { server } from './server.js'
import { hasServer } from './hasServer.js'
import { cast } from 'server/cast.js'

export const hasDevice = (
  state: TeamState,
  deviceId: string,
  options = { includeRemoved: false }
) => {
  return getDevice(state, deviceId, options) !== undefined
}

export const device = (state: TeamState, deviceId: string, options = { includeRemoved: false }) => {
  const device = getDevice(state, deviceId, options)
  assert(device, `Device ${deviceId} not found`)
  return device
}

const getDevice = (state: TeamState, deviceId: string, options = { includeRemoved: false }) => {
  if (hasServer(state, deviceId)) {
    return cast.toDevice(server(state, deviceId))
  }
  const members = state.members.concat(options.includeRemoved ? state.removedMembers : [])
  const allDevices = members.flatMap(m => m.devices ?? [])
  return (
    allDevices.find(d => d.deviceId === deviceId) ??
    (options.includeRemoved ? state.removedDevices.find(d => d.deviceId === deviceId) : undefined)
  )
}
