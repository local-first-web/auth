import { Reducer } from './index'

export const setTeamName = (teamName: string): Reducer => state => ({
  ...state,
  teamName,
})
