import { hasMember } from './hasMember'
import { member } from './member'
import { TeamState } from '@/team/types'
import { assert } from '@/util'

export const hasDevice = (
  state: TeamState,
  userId: string,
  deviceName: string,
  options = { includeRemoved: false }
) => {
  if (!hasMember(state, userId)) return false
  return getDevice(state, userId, deviceName, options) !== undefined
}

export const device = (
  state: TeamState,
  userId: string,
  deviceName: string,
  options = { includeRemoved: false }
) => {
  const device = getDevice(state, userId, deviceName, options)
  assert(device, `Member ${userId} does not have a device called ${deviceName}`)
  return device
}

const getDevice = (
  state: TeamState,
  userId: string,
  deviceName: string,
  options = { includeRemoved: false }
) => {
  const memberDevices = member(state, userId, options).devices ?? []
  return (
    memberDevices.find(d => d.deviceName === deviceName) ??
    (options.includeRemoved
      ? state.removedDevices.find(d => d.deviceName === deviceName && d.userId === userId)
      : undefined)
  )
}
