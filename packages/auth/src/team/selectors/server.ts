import { Host } from '@/server'
import { TeamState } from '@/team/types'

export const server = (state: TeamState, host: Host, options = { includeRemoved: false }) => {
  const serversToSearch = [
    ...state.servers,
    ...(options.includeRemoved ? state.removedServers : []),
  ]
  const server = serversToSearch.find(s => s.host === host)

  if (server === undefined) throw new Error(`A server with host '${host}' was not found`)
  return server
}
