import { hasMember } from './hasMember'
import { member } from './member'
import { TeamState } from '@/team/types'
import { assert } from '@/util'

export const hasDevice = (state: TeamState, userName: string, deviceName: string) => {
  return hasMember(state, userName) && getDevice(state, userName, deviceName) !== undefined
}

export const device = (state: TeamState, userName: string, deviceName: string) => {
  const device = getDevice(state, userName, deviceName)
  assert(device, `Member ${userName} does not have a device called ${deviceName}`)
  return device
}

const getDevice = (state: TeamState, userName: string, deviceName: string) => {
  const memberDevices = member(state, userName).devices || []
  return memberDevices.find(d => d.deviceName === deviceName)
}
