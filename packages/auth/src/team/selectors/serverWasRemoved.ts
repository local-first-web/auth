import { Url } from '@/server'
import { TeamState } from '@/team/types'

export const serverWasRemoved = (state: TeamState, url: Url) =>
  state.removedServers.some(s => s.url === url)
