import { type Reducer } from './types.js'
import { type Action, type Graph, type Resolver } from 'graph/index.js'
import { type Keyring, type KeysetWithSecrets } from 'keyset/index.js'
import { type UserWithSecrets } from 'user/index.js'
import { type ValidatorSet } from 'validator/index.js'

export type StoreOptions<S, A extends Action, C> = {
  /** The user local user, along with their secret keys for signing, encrypting, etc.  */
  user: UserWithSecrets

  /** Additional context information to be added to each link (e.g. device, client, etc.) */
  context?: C

  /** A Redux-style reducer that calculates a new state given the previous state and an action. In
   *  this case an "action" is a link in a hash graph. */
  reducer: Reducer<S, A, C>

  /** A resolver defines how any two concurrent sequences will be merged. It is a pure function that is
   *  given two concurrent branches and returns a single branch. This is where you implement any
   *  domain-specific conflict-resolution logic. */
  resolver?: Resolver<A, C>

  /** Optional validators expressing what this application means by a well-formed change.
   *
   *  These are not consulted when state is computed: `makeMachine` replays a graph against the
   *  structural rules alone, so a link these would refuse still folds into state. They're run by
   *  `Store.validate`, alongside the built-in rules — which check hashes, `prev` links and the ROOT
   *  link, and do not check signatures — and that's where the application asks about them. */
  validators?: ValidatorSet

  /** The initial state to provide to the reducer's first action. By default this is an empty object `{}` */
  initialState?: S

  /** For pre-existing stores: A graph to preload, e.g. from saved state. */
  graph?: Uint8Array | Graph<A, C>

  /** For new stores: Additional information to include in the root node  */
  rootPayload?: unknown

  keys: KeysetWithSecrets | Keyring
}
