import { Keyset } from 'crdx'
import { Transform } from '@/team/types'

export const changeServerKeys =
  (keys: Keyset): Transform =>
  state => {
    return {
      ...state,
      servers: state.servers.map(server =>
        server.host === keys.name
          ? {
              ...server,
              keys, // 🡐 replace keys with new ones
            }
          : server,
      ),
    }
  }
