import { Reducer } from '/team/reducers/index'

export const setTeamName = (teamName: string): Reducer => state => ({
  ...state,
  teamName,
})
