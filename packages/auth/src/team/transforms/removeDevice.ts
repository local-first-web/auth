import * as select from '@/team/selectors'
import { Member, Transform } from '@/team/types'

export const removeDevice =
  (userId: string, deviceName: string): Transform =>
  state => {
    const removedDevice = select.device(state, userId, deviceName)

    const removeDeviceFromMember = (member: Member) =>
      member.userId !== userId
        ? member
        : {
            ...member,
            devices: member.devices!.filter(d => d.deviceName !== deviceName),
          }

    const members = state.members.map(removeDeviceFromMember)
    const removedDevices = [...state.removedDevices, removedDevice]

    return {
      ...state,
      members,
      removedDevices,
    }
  }
