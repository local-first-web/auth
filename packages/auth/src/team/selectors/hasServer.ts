import { Host } from '@/server'
import { TeamState } from '@/team/types'

export const hasServer = (state: TeamState, host: Host) =>
  state.servers.find(s => s.host === host) !== undefined
