import * as select from '@/team/selectors'
import { Member, Transform } from '@/team/types'
import { KeyType } from 'crdx'

export const removeDevice =
  (userName: string, deviceName: string): Transform =>
  state => {
    const removedDevice = select.device(state, userName, deviceName)

    const removeDeviceFromMember = (member: Member) =>
      member.userName !== userName
        ? member
        : {
            ...member,
            devices: member.devices!.filter(d => d.deviceName !== deviceName),
          }
    const members = state.members.map(removeDeviceFromMember)

    const removedDevices = [...state.removedDevices, removedDevice]

    const remainingLockboxes = state.lockboxes.filter(
      lockbox =>
        !(
          lockbox.recipient.type === KeyType.DEVICE &&
          lockbox.recipient.name === userName &&
          lockbox.contents.name === deviceName
        )
    )

    return {
      ...state,
      members,
      removedDevices,
      lockboxes: remainingLockboxes,
    }
  }
