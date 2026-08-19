import { type Reducer } from './types.js'
import { type Action, type Graph, type Resolver } from '../graph/index.js'
import { type Keyring, type KeysetWithSecrets } from '../keyset/index.js'
import { type UserWithSecrets } from '../user/index.js'
import { type ValidatorSet } from '../validator/index.js'

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
   *  `Store.validate`, which is where the application asks about them — and which runs all five
   *  built-in rules alongside them, not just the structural three. Those five are: each link's
   *  hash matches its bytes, the links named in its `prev` exist, the ROOT link is the graph's
   *  root, no link is stamped ahead of this device's clock, and no link is older than a link it
   *  descends from. The last two are advisory — honest peers whose clocks disagree trip them — so
   *  expect to see them here. None of the five checks a signature. A failure can also come from
   *  `runValidators`' own bookkeeping, which runs before any of the five: `root` and `head` naming
   *  links whose bytes hash to those names, and the count of encrypted links matching the count of
   *  links. Those report a failure the same way the five do, as a result rather than an exception. */
  validators?: ValidatorSet

  /** The initial state to provide to the reducer's first action. By default this is an empty object `{}` */
  initialState?: S

  /** For pre-existing stores: A graph to preload, e.g. from saved state. */
  graph?: Uint8Array | Graph<A, C>

  /** For new stores: Additional information to include in the root node  */
  rootPayload?: unknown

  keys: KeysetWithSecrets | Keyring
}
