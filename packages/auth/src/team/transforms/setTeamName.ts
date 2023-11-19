import { type Transform } from 'team/types.js'

export const setTeamName =
  (teamName: string): Transform =>
  state => ({
    ...state,
    teamName,
  })
