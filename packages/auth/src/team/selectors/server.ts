import { Url } from '@/server'
import { TeamState } from '@/team/types'

export const server = (state: TeamState, url: Url, options = { includeRemoved: false }) => {
  const serversToSearch = [
    ...state.servers,
    ...(options.includeRemoved ? state.removedServers : []),
  ]
  const server = serversToSearch.find(s => s.url === url)

  if (server === undefined) throw new Error(`A server with url '${url}' was not found`)
  return server
}
