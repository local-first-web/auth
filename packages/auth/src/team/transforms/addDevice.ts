import { getDeviceId, type Device } from 'device/index.js'
import { type Transform } from 'team/types.js'

export const addDevice =
  (device: Device): Transform =>
  state => {
    const { userId } = device
    return {
      ...state,

      // Add device to the member's list of devices
      members: state.members.map(member => {
        if (member.userId === userId) {
          const { devices = [] } = member
          return {
            ...member,
            devices: [...devices, device],
          }
        }

        return member
      }),

      // Remove device ID from list of removed devices (e.g. if it was removed at one point and is being re-added)
      removedDevices: state.removedDevices.filter(d => d.keys.name === getDeviceId(device)),
    }
  }
