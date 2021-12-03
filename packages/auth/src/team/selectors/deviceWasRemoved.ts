import { TeamState } from '@/team/types'

export const deviceWasRemoved = (state: TeamState, deviceId: string) =>
  state.removedDevices.some(d => d.keys.name === deviceId)
