import { type Server } from 'server/index.js'
import { type Transform } from 'team/types.js'

export const addServer =
  (newServer: Server): Transform =>
  state => ({
    ...state,

    // Add server to the team's list of servers
    servers: [
      ...state.servers,
      {
        ...newServer,
        roles: [],
      },
    ],

    // Remove server's url from list of removed servers (e.g. if server was removed and is now being re-added)
    removedservers: state.removedServers.filter(m => m.host === newServer.host),
  })
