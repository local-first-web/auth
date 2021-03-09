import { Reducer } from '@/team/reducers/index'
import { PublicDevice } from '@/device'

export const addDevice = (device: PublicDevice): Reducer => state => {
  const { userName } = device
  return {
    ...state,
    members: state.members.map(member => {
      if (member.userName === userName) {
        const { devices = [] } = member
        devices.push(device)
        return {
          ...member,
          devices,
        }
      } else return member
    }),
  }
}
