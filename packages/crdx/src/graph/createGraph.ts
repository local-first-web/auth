import cuid from 'cuid'
import { append } from './append'
import { Action, Graph } from './types'
import { ROOT } from '/constants'
import { KeysetWithSecrets } from '/keyset'
import { UserWithSecrets } from '/user'

export const EMPTY_GRAPH = {
  root: undefined,
  head: undefined,
  encryptedLinks: {},
  links: {},
}

interface CreateGraphParams<C = {}> {
  /** Local user (with secret keys) that is creating the graph.  */
  user: UserWithSecrets

  /** Unique identifier for the graph. If none is provided, a random one will be generated. */
  id?: string

  /** Human facing name of the graph (e.g. document name, team name, etc). This should be unique
   * within the application's namespace. If none is provided, the `id` will be used. */
  name?: string

  /** Object containing information to be added to the ROOT link. */
  rootPayload?: any

  /** Any additional context provided by the application. */
  context?: C

  /** Keyset used to encrypt & decrypt the graph. */
  keys: KeysetWithSecrets
}

export const createGraph = <A extends Action, C = {}>({
  user,
  id = cuid(),
  name = id,
  rootPayload = {},
  context = {} as C,
  keys,
}: CreateGraphParams<C>) => {
  const rootAction = {
    type: ROOT,
    prev: [],
    payload: {
      name,
      id,
      ...rootPayload, // the root payload may override name or id
    },
  } as Action
  const graph = append({
    graph: EMPTY_GRAPH,
    action: rootAction,
    user,
    context,
    keys,
  })
  return graph as Graph<A, C>
}
