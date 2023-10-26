import { type TeamLink, type Transform } from './types.js'

export const setHead =
  (link: TeamLink): Transform =>
  state => ({ ...state, head: [link.hash] })
