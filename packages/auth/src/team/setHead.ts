import { TeamLink, Transform } from './types.js'

export const setHead =
  (link: TeamLink): Transform =>
  state => {
    return { ...state, head: [link.hash] }
  }
