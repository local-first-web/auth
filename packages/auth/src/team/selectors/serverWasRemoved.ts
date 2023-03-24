import { Host } from '@/server'
import { TeamState } from '@/team/types'

export const serverWasRemoved = (state: TeamState, host: Host) =>
  state.removedServers.some(s => s.host === host)
