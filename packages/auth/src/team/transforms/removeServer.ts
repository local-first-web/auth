import { Url } from '@/server'
import { Transform } from '@/team/types'

export const removeServer =
  (url: Url): Transform =>
  state => {
    const remainingServers = state.servers.filter(m => m.url !== url)
    const removedServer = state.servers.find(m => m.url === url) // the server that was removed

    const removedServers = [...state.removedServers]
    if (removedServer) removedServers.push(removedServer)

    return {
      ...state,
      servers: remainingServers,
      removedServers,
    }
  }
