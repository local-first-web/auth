import { type Reducer } from './types.js'
import { type Action, getSequence, type Graph, type Resolver } from 'graph/index.js'
import { validateStructure } from 'validator/index.js'

export const makeMachine = <S, A extends Action, C>({
  initialState,
  reducer,
  resolver,
}: MachineParams<S, A, C>) => {
  return (graph: Graph<A, C>) => {
    // Everything below reads the graph as though its structure holds — the resolver sequences it
    // and the reducer folds it — so a graph that isn't replayable is refused here rather than
    // replayed. This is what makes those rules mean anything on the paths that reach a graph by
    // construction or by merge rather than over the wire, where nothing else checks them:
    // `validateRoot`, in particular, is the only thing that says a link claiming to be the ROOT
    // link is the graph's root.
    //
    // Only the structural rules are fatal. The advisory ones compare the graph against this
    // device's clock, and a peer whose clock ran fast would otherwise leave the graph unopenable
    // until wall clock caught up with it — `Store.validate` is where those get asked about, along
    // with any validators the application supplied.
    const structure = validateStructure(graph)
    if (!structure.isValid) throw structure.error

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
}
