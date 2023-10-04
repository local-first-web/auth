import { parseDeviceId } from '@/device/index.js'
import { Keyset } from 'crdx'
import { Transform } from '@/team/types.js'

export const changeDeviceKeys =
  (keys: Keyset): Transform =>
  state => {
    const { userId, deviceName } = parseDeviceId(keys.name)
    return {
      ...state,
      members: state.members.map(member => {
        if (member.userId === userId) {
          return {
            ...member,
            devices: member.devices?.map(device => {
              if (device.deviceName === deviceName)
                return {
                  ...device,
                  keys, // 🡐 replace device keys
                }
              else return device
            }),
          }
        } else return member
      }),
    }
  }
