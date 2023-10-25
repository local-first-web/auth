import { type Keyset } from '@localfirst/crdx'
import { parseDeviceId } from '@/device/index.js'
import { type Transform } from '@/team/types.js'

export const changeDeviceKeys =
  (keys: Keyset): Transform =>
  state => {
    const { userId, deviceName } = parseDeviceId(keys.name)
    return {
      ...state,
      members: state.members.map(member =>
        member.userId === userId
          ? {
              ...member,
              devices: member.devices?.map(device =>
                device.deviceName === deviceName
                  ? {
                      ...device,
                      keys, // 🡐 replace device keys
                    }
                  : device
              ),
            }
          : member
      ),
    }
  }
