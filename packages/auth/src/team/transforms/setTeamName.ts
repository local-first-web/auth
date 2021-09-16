import { Transform } from '@/team/types'

// TODO we haven't exposed this yet because we're using the team name as a unique identifier.
// We need to put in place a team ID that's a stable CUID.

export const setTeamName =
  (teamName: string): Transform =>
  state => ({
    ...state,
    teamName,
  })
