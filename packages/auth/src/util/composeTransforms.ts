import { Transform } from '@/team/types'

export const composeTransforms =
  (transforms: Transform[]): Transform =>
  state =>
    transforms.reduce((state, transform) => transform(state), state)
