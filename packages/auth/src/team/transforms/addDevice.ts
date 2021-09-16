import { Transform } from '@/team/types'
import { getDeviceId, PublicDevice } from '@/device'

export const addDevice =
  (device: PublicDevice): Transform =>
  state => {
    const { userName } = device
    return {
      ...state,

      // add device to the member's list of devices
      members: state.members.map(member => {
        if (member.userName === userName) {
          const { devices = [] } = member
          return {
            ...member,
            devices: [...devices, device],
          }
        } else return member
      }),

      // remove device ID from list of removed devices (e.g. if it was removed at one point and is being re-added)
      removedDevices: state.removedDevices.filter(deviceId => deviceId === getDeviceId(device)),
    }
  }
