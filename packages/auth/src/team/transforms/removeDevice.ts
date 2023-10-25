import * as select from '@/team/selectors/index.js'
import { type Member, type Transform } from '@/team/types.js'

export const removeDevice =
  (userId: string, deviceName: string): Transform =>
  state => {
    const removedDevice = select.device(state, userId, deviceName)

    const removeDeviceFromMember = (member: Member) =>
      member.userId === userId
        ? {
            ...member,
            devices: member.devices.filter(d => d.deviceName !== deviceName),
          }
        : member

    const members = state.members.map(removeDeviceFromMember)
    const removedDevices = [...state.removedDevices, removedDevice]

    return {
      ...state,
      members,
      removedDevices,
    }
  }
