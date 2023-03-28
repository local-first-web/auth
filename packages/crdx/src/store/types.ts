import { Action, Link } from '/graph'

export type Reducer<S, A extends Action, C = {}> = (state: S, link: Link<A, C>) => S
