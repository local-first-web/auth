import { parseDeviceId } from '@/device'
import { PublicKeyset } from '@/keyset'
import { Reducer } from '@/team/reducers/index'
import { debug } from '@/util'

const log = debug('lf:auth:reducer')

export const changeDeviceKeys = (keys: PublicKeyset): Reducer => state => {
  const { userName, deviceName } = parseDeviceId(keys.name)
  return {
    ...state,
    members: state.members.map(member => {
      if (member.userName === userName) {
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
