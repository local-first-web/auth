import { Host } from '@/server'
import { Transform } from '@/team/types'

export const removeServer =
  (host: Host): Transform =>
  state => {
    const remainingServers = state.servers.filter(m => m.host !== host)
    const removedServer = state.servers.find(m => m.host === host) // the server that was removed

    const removedServers = [...state.removedServers]
    if (removedServer) removedServers.push(removedServer)

    return {
      ...state,
      servers: remainingServers,
      removedServers,
    }
  }
