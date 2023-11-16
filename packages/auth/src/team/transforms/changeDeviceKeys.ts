import { type Keyset } from '@localfirst/crdx'
import * as select from 'team/selectors/index.js'
import { type Transform } from 'team/types.js'

export const changeDeviceKeys =
  (keys: Keyset): Transform =>
  state => {
    const deviceId = keys.name
    const device = select.deviceById(state, deviceId)
    const { userId, deviceName } = device
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
