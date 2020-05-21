import { Transform } from './index'

export const setTeamName = (teamName: string): Transform => (state) => ({
  ...state,
  teamName,
})
