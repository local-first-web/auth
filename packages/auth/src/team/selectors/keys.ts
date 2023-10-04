import { TeamState } from '@/team/types.js'
import { assert } from '@/util/index.js'
import { lockboxSummary } from '@/util/lockboxSummary.js'
import { KeyMetadata, KeyScope, KeysetWithSecrets } from 'crdx'
import { getKeyMap } from './getKeyMap.js'

/** Returns the keys for the given scope, if they are in a lockbox that the current device has access to */
export const keys = (
  state: TeamState,
  deviceKeys: KeysetWithSecrets,
  scope: KeyScope | KeyMetadata,
) => {
  const { type, name } = scope

  const keysFromLockboxes = getKeyMap(state, deviceKeys)
  const keys = keysFromLockboxes[type] ? keysFromLockboxes[type][name] : undefined

  assert(
    keys,
    `Couldn't find keys: ${type.toLowerCase()} ${name}.
     Scope: ${JSON.stringify(scope)}
     Device: ${deviceKeys.name}
     Available lockboxes: \n- ${state.lockboxes.map(lockboxSummary).join('\n- ')} `,
  )

  const generation =
    'generation' in scope && scope.generation !== undefined ? scope.generation : keys.length - 1 // use latest generation by default
  return keys[generation]
}
