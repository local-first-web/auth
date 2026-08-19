import { type Reducer } from './types.js'
import { type Action, getSequence, type Graph, type Resolver } from 'graph/index.js'
import { validate, type ValidatorSet } from 'validator/index.js'

export const makeMachine = <S, A extends Action, C>({
  initialState,
  reducer,
  resolver,
  validators,
}: MachineParams<S, A, C>) => {
  return (graph: Graph<A, C>) => {
    // Validate the graph's integrity. Everything below reads the graph as though it holds — the
    // resolver sequences it and the reducer folds it — so a graph that doesn't check out is
    // refused here rather than replayed. This is what makes the base validators mean something on
    // the paths that reach a graph by construction or by merge rather than over the wire:
    // `validateRoot`, in particular, is the only thing that says a link claiming to be the ROOT
    // link is the graph's root.
    const validation = validate(graph, validators)
    if (!validation.isValid) throw validation.error

    // Use the filter & sequencer to turn the graph into an ordered sequence
    const sequence = getSequence(graph, resolver)

    // Run the sequence through the reducer to calculate the current team state
    return sequence.reduce(reducer, initialState)
  }
}

type MachineParams<S, A extends Action, C> = {
  initialState: S
  reducer: Reducer<S, A, C>
  resolver: Resolver<A, C>
  validators?: ValidatorSet
}
