import { hasMember } from './hasMember'
import { member } from './member'
import { TeamState } from '@/team/types'
import { assert } from '@/util'

export const hasDevice = (
  state: TeamState,
  userName: string,
  deviceName: string,
  options = { includeRemoved: false }
) => {
  if (!hasMember(state, userName)) return false
  return getDevice(state, userName, deviceName, options) !== undefined
}

export const device = (
  state: TeamState,
  userName: string,
  deviceName: string,
  options = { includeRemoved: false }
) => {
  const device = getDevice(state, userName, deviceName, options)
  assert(device, `Member ${userName} does not have a device called ${deviceName}`)
  return device
}

const getDevice = (
  state: TeamState,
  userName: string,
  deviceName: string,
  options = { includeRemoved: false }
) => {
  const memberDevices = member(state, userName).devices ?? []
  return (
    memberDevices.find(d => d.deviceName === deviceName) ??
    (options.includeRemoved
      ? state.removedDevices.find(d => d.deviceName === deviceName && d.userName === userName)
      : undefined)
  )
}
