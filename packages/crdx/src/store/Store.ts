import EventEmitter from 'events'
import { StoreOptions } from './StoreOptions'
import { Reducer } from './types'
import {
  Action,
  append,
  baseResolver,
  createGraph,
  deserialize,
  getHead,
  getSequence,
  Graph,
  merge,
  Resolver,
  serialize,
} from '/graph'
import { isKeyset, Keyring, KeysetWithSecrets } from '/keyset'
import { createKeyring } from '/keyset/createKeyring'
import { UserWithSecrets } from '/user'
import { assert, Optional } from '/util'
import { validate, ValidatorSet } from '/validator'

/**
 * A CRDX `Store` is intended to work very much like a Redux store.
 * https://github.com/reduxjs/redux/blob/master/src/createStore.ts
 *
 * The only way to change the data in the store is to `dispatch` an action to it. There should only
 * be a single store in an application.
 */
export class Store<S, A extends Action, C = {}> extends EventEmitter {
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
    } else if (typeof graph === 'string') {
      // serialized graph was provided, so deserialize it
      assert(keys)
      this.graph = deserialize(graph, keys)
    } else {
      // graph provided
      this.graph = graph
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
    this.updateState()
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
      // no keys provided, so use the last keys we used
      // TODO: if there are multiple heads, we'll have a bunch of edge cases to sort out. For now just picking the first one.
      const lastHash = this.graph.head[0]
      const lastPublicKey = this.graph.encryptedLinks[lastHash].recipientPublicKey
      keys = this.keyring[lastPublicKey]
    } else {
      // record this key in our keyring
      this.keyring[keys.encryption.publicKey] = keys
    }

    // append this action as a new link to the graph
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
    this.graph = merge(this.graph, theirGraph)
    this.updateState()
    return this
  }

  /**
   * Validates the store's integrity, using the built-in validators (verify hashes, check
   * timestamps, etc.) as well as any custom validators provided by the application.
   */
  public validate() {
    return validate(this.graph, this.validators)
  }

  // PRIVATE

  /** The user object provided in options */
  private user: UserWithSecrets

  /** The context object provided in options */
  private context: C

  /** The inital state provided in options */
  private initialState: S

  /** The reducer function provided in the constructor */
  private reducer: Reducer<S, A, C>
  private resolver: Resolver<A, C>
  private validators?: ValidatorSet

  private keyring: Keyring

  private graph: Graph<A, C>
  private state: S

  private updateState() {
    const { graph, resolver, reducer } = this

    // Validate the graph's integrity.
    this.validate()

    // Use the filter & sequencer to turn the graph into an ordered sequence
    const sequence = getSequence<A, C>(graph, resolver)

    // Run the sequence through the reducer to calculate the current team state
    this.state = sequence.reduce(reducer, this.initialState)

    // notify listeners
    this.emit('updated', { head: graph.head })
  }
}
