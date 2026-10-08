import { type Reducer } from './types.js'
import { type Action, getSequence, type Graph, type Resolver } from '../graph/index.js'
import { validateStructure } from '../validator/index.js'

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
    // Only the structural rules are fatal, and the line to draw is not 'does this rule read a
    // clock' — it's whether an honest peer can produce a graph that fails it. The timestamp rules
    // both fail that test once two honest peers disagree about the time. Making either fatal would
    // take an ordinary NTP step or resume from sleep and lock someone out of a document they can
    // otherwise replay perfectly well: for the future-timestamp rule, whoever's clock is behind is
    // locked out until wall clock catches up (the fast peer that wrote the link never sees it), and
    // for the order rule, which reads no clock at all, every peer is locked out for good, because
    // the graph never changes.
    // `Store.validate` is where those get asked about, along with any validators the application
    // supplied. See `advisoryValidators`.
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
