import { Reducer } from './types'
import { Action } from '/graph'

export const compose =
  <S, A extends Action>(reducers: Reducer<S, A>[]): Reducer<S, A> =>
  (state, action) =>
    reducers.reduce((state, reducer) => reducer(state, action), state)
