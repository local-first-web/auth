import { type KeyScope } from '@localfirst/crdx'
import { type TeamState } from '../types.js'
import { unique } from '../../util/unique.js'
import { cycleGuard, type CycleGuard } from '../../util/walkLockboxGraph.js'

/**
 * Returns all scopes whose keys can be reached, directly or indirectly, from the given scope.
 *
 * `Team.rotateKeys` calls this to find everything a compromised scope could see, so a walk that
 * doesn't come back is a rotation that doesn't happen. See `cycleGuard` — this walk and
 * `visibleKeys` are the two over the lockbox graph, and they take their guard from the same place
 * so that fixing one can't leave the other behind.
 */
export const visibleScopes = (
  state: TeamState,
  { type, name }: KeyScope,
  guard: CycleGuard = cycleGuard()
): KeyScope[] => {
  if (guard.walkedAlready(`${type}:${name}`)) return []

  // Find the keys that the given key can see
  const scopes = state.lockboxes
    .filter(({ recipient }) => recipient.type === type && recipient.name === name)
    .map(({ contents: { type, name } }) => ({ type, name }) as KeyScope)

  // Recursively find all the keys that _those_ keys can see
  const derivedScopes = scopes.flatMap(scope => visibleScopes(state, scope, guard))

  const allScopes = [...scopes, ...derivedScopes]
  return unique(allScopes, s => s.name + s.type)
}
