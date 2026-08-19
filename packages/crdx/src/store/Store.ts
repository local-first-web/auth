import { EventEmitter } from '@herbcaudill/eventemitter42'
import { assert } from '@localfirst/shared'
import {
  append,
  baseResolver,
  createGraph,
  deserialize,
  getHead,
  merge,
  serialize,
  type Action,
  type Graph,
  type Resolver,
} from '../graph/index.js'
import { createKeyring } from '../keyset/createKeyring.js'
import { isKeyset, type Keyring, type KeysetWithSecrets } from '../keyset/index.js'
import { type UserWithSecrets } from '../user/index.js'
import { type Hash, type Optional } from '../util/index.js'
import { validate, type ValidatorSet } from '../validator/index.js'
import { type StoreOptions } from './StoreOptions.js'
import { makeMachine } from './makeMachine.js'
import { type Reducer } from './types.js'

/**
 * A CRDX `Store` is intended to work very much like a Redux store.
 * https://github.com/reduxjs/redux/blob/master/src/createStore.ts
 *
 * The only way to change the data in the store is to `dispatch` an action to it. There should only
 * be a single store in an application.
 */
export class Store<
  S,
  A extends Action,
  C = Record<string, unknown>,
> extends EventEmitter<StoreEvents> {
  private readonly user: UserWithSecrets
  private readonly context: C

  private readonly initialState: S
  private readonly reducer: Reducer<S, A, C>
  private readonly resolver: Resolver<A, C>
  private readonly validators?: ValidatorSet

  private keyring: Keyring

  private graph: Graph<A, C>
  private state: S

  constructor({
    user,
    context = {} as C,
    graph,
    rootPayload,
    initialState = {} as S,
    reducer,
    validators,
    resolver = baseResolver,
    keys,
  }: StoreOptions<S, A, C>) {
    super()

    if (graph === undefined) {
      // no graph provided, so we'll create a new one
      assert(isKeyset(keys), 'If no graph is provided, only pass a single keyset, not a keyring.')
      this.graph = createGraph({ user, rootPayload, keys })
    } else if (isGraph(graph)) {
      // graph provided
      this.graph = graph
    } else {
      // serialized graph was provided, so deserialize it
      assert(keys)
      this.graph = deserialize(graph, keys)
    }

    this.context = context
    this.initialState = initialState
    this.reducer = reducer
    this.validators = validators
    this.resolver = resolver
    this.user = user

    // if a single keyset was provided, wrap it in a keyring
    this.keyring = createKeyring(keys)

    // set the initial state
    this.state = this.replay(this.graph)
    this.emit('updated', { head: this.graph.head })
  }

  /** Returns the store's most recent state. */
  public getState(): S {
    return this.state
  }

  /** Returns the current hash graph */
  public getGraph(): Graph<A, C> {
    return this.graph
  }

  /**
   * Returns the current hash graph in serialized form; this can be used to rehydrate this
   * store from storage.
   * */
  public save() {
    return serialize(this.graph)
  }

  /**
   * Dispatches an action to be added to the hash graph. This is the only way to trigger a
   * state change.
   *
   * The `reducer` function provided when creating the store will be called with the current state
   * and the given `action`. Its return value will be considered the **next** state of the tree,
   * and any change listeners will be notified.
   *
   * @returns For convenience, the same action object that was dispatched.
   */
  public dispatch(
    /**
     * A Redux-style plain object representing what changed. An action must have a `type` property
     * which may not be `undefined`. It is a good idea to use string constants for action types.
     */
    action: Optional<A, 'payload'>,

    /**
     * Keys used to encrypt the action's payload. If not provided, the action will be encrypted
     * using the same keys as the previous action.
     */
    keys?: KeysetWithSecrets
  ) {
    // equip the action with an empty payload if it doesn't have one
    const actionWithPayload = {
      payload: undefined,
      ...action,
    } as A

    if (keys === undefined) {
      // no keys provided, so use the same keys used for the previous link
      const prevHash = this.graph.head.sort()[0] // if multiple heads, use the first one
      const prevPublicKey = this.graph.encryptedLinks[prevHash].recipientPublicKey
      keys = this.keyring[prevPublicKey]
    } else {
      // record this key in our keyring
      this.keyring[keys.encryption.publicKey] = keys
    }

    // append this action as a new link to the graph
    //
    // Note that this path still commits the link before the reducer sees it, so an action our own
    // reducer refuses lands on our graph anyway — the same brick `merge` no longer produces. The
    // door for this path is in the application: `Team.dispatch` refuses a malformed payload before
    // it gets here. Closing it here as well is a separate change, because the tests that forge a
    // peer's malformed link do it by dispatching one through this path on purpose.
    this.graph = append({
      graph: this.graph,
      action: actionWithPayload,
      user: this.user,
      keys,
      context: this.context,
    })

    // get the newly appended link (at this point we're guaranteed a single head, which is the one we appended)
    const [head] = getHead(this.graph)

    // we don't need to pass the whole graph through the reducer, just the current state + the new head
    this.state = this.reducer(this.state, head)

    // notify listeners
    this.emit('updated', { head: this.graph.head })

    return action
  }

  /**
   * Merges another graph (e.g. from a peer) with ours.
   * @param theirGraph
   * @returns this `Store` instance
   */
  public merge(theirGraph: Graph<A, C>) {
    // Refusing a peer's graph has to leave us as we were. Replay happens against a candidate, and
    // we only adopt it if that succeeds — otherwise a refusal would leave the offending link on our
    // graph, and a graph we've refused once we can never load again. Everything that says no to a
    // link says it by throwing from here, so this is what keeps a refusal a refusal rather than a
    // graph nobody can open.
    const candidate = merge(this.graph, theirGraph)
    const state = this.replay(candidate)

    this.graph = candidate
    this.state = state

    // notify listeners
    this.emit('updated', { head: this.graph.head })
  }

  /**
   * Validates the store's integrity, using the built-in validators (verify hashes, check
   * timestamps, etc.) as well as any custom validators provided by the application.
   *
   * Everything it finds comes back as a `ValidationResult`, including the bookkeeping `runValidators`
   * checks before any validator runs: that `root` and each `head` name a link whose bytes hash to
   * that name, that an encrypted link exists wherever one is looked up, and that there are as many
   * encrypted links as links. A missing encrypted link used to throw out of here instead of
   * returning; it doesn't any more.
   *
   * A failure here doesn't mean the store is unusable — this runs the advisory timestamp rules and
   * the application's own validators as well as the structural ones, and only the structural ones
   * say whether a graph can be replayed at all.
   */
  public validate() {
    return validate(this.graph, this.validators)
  }

  // PRIVATE

  /**
   * Replays a graph from its root and returns the resulting state. Throws if the graph can't be
   * replayed — either because it isn't structurally sound, or because the reducer refuses one of
   * its links. Nothing here touches this store, so the caller decides whether to adopt the graph.
   */
  private replay(graph: Graph<A, C>) {
    // `makeMachine` refuses a graph that isn't structurally replayable. Application validators
    // aren't its business — they say what this application means by a well-formed change, and
    // `validate` is where the application asks about them.
    const machine = makeMachine({
      initialState: this.initialState,
      reducer: this.reducer,
      resolver: this.resolver,
    })
    return machine(graph)
  }
}

const isGraph = <A extends Action, C>(source: Uint8Array | Graph<A, C>): source is Graph<A, C> =>
  source?.hasOwnProperty('root')

type StoreEvents = {
  updated: (payload: { head: Hash[] }) => void
}
