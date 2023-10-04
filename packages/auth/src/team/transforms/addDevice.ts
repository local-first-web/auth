import { Transform } from '@/team/types.js'
import { getDeviceId, Device } from '@/device/index.js'

export const addDevice =
  (device: Device): Transform =>
  state => {
    const { userId } = device
    return {
      ...state,

      // add device to the member's list of devices
      members: state.members.map(member => {
        if (member.userId === userId) {
          const { devices = [] } = member
          return {
            ...member,
            devices: [...devices, device],
          }
        } else return member
      }),

      // remove device ID from list of removed devices (e.g. if it was removed at one point and is being re-added)
      removedDevices: state.removedDevices.filter(d => d.keys.name === getDeviceId(device)),
    }
  }
