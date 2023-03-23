import { Server } from '@/server'
import { Transform } from '@/team/types'

export const addServer =
  (newServer: Server): Transform =>
  state => ({
    ...state,

    // add server to the team's list of servers
    servers: [
      ...state.servers,
      {
        ...newServer,
        roles: [],
      },
    ],

    // remove server's url from list of removed servers (e.g. if server was removed and is now being re-added)
    removedservers: state.removedServers.filter(m => m.url === newServer.url),
  })
