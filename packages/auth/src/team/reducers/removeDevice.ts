import { Reducer } from '@/team/reducers/index'
import { KeyType } from '@/keyset'

export const removeDevice = (userName: string, deviceName: string): Reducer => state => ({
  ...state,

  // remove this device from this member's list of devices
  members: state.members.map(member => {
    return member.userName === userName
      ? {
          ...member,
          devices: member.devices!.filter(d => d.deviceName !== deviceName),
        }
      : member
  }),

  // remove any lockboxes this device has
  lockboxes: state.lockboxes.filter(
    lockbox =>
      !(
        lockbox.recipient.type === KeyType.DEVICE &&
        lockbox.recipient.name === userName &&
        lockbox.contents.name === deviceName
      )
  ),
})
