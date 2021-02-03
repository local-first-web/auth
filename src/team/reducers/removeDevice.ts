import { Reducer } from '/team/reducers/index'
import { KeyType } from '/keyset'

export const removeDevice = (userName: string, deviceId: string): Reducer => (state) => ({
  ...state,

  // remove this device from this member's list of devices
  members: state.members.map((member) => {
    return {
      ...member,
      devices:
        member.userName !== userName //
          ? member.devices // leave other members' devices alone
          : member.devices?.filter((d) => d.deviceId !== deviceId),
    }
  }),

  // remove any lockboxes this device has
  lockboxes: state.lockboxes.filter(
    (lockbox) =>
      !(
        lockbox.recipient.name === userName &&
        lockbox.contents.type === KeyType.DEVICE &&
        lockbox.contents.name === deviceId
      )
  ),
})
