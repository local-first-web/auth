import { TeamLink, Transform } from './types'

export const setHead =
  (link: TeamLink): Transform =>
  state => {
    return { ...state, head: [link.hash] }
  }
