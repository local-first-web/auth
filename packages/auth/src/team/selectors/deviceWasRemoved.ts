import { TeamState } from '@/team/types'

export const deviceWasRemoved = (state: TeamState, deviceId: string) =>
  state.removedDevices.includes(deviceId)
