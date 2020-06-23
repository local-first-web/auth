import { Reducer } from '/team/reducers/index'
import { Device } from '/device'

export const addDevice = (device: Device): Reducer => state => {
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
