import { TeamState } from '@/team/types'
import { assert } from '@/util'
import { lockboxSummary } from '@/util/lockboxSummary'
import { KeyMetadata, KeyScope, KeysetWithSecrets } from '@localfirst/crdx'
import { getKeyMap } from './getKeyMap'

/** Returns the keys for the given scope, if they are in a lockbox that the current device has access to */
export const keys = (
  state: TeamState,
  deviceKeys: KeysetWithSecrets,
  scope: KeyScope | KeyMetadata
) => {
  const { type, name } = scope

  const keysFromLockboxes = getKeyMap(state, deviceKeys)
  const keys = keysFromLockboxes[type] ? keysFromLockboxes[type][name] : undefined

  assert(
    keys,
    `Couldn't find keys: ${JSON.stringify(scope)}
     Device: ${deviceKeys.name}
     Available lockboxes: \n- ${state.lockboxes.map(lockboxSummary).join('\n- ')} 
     Keymap: ${JSON.stringify(keysFromLockboxes, null, 2)}`
  )

  const generation =
    'generation' in scope && scope.generation !== undefined
      ? // return specific generation if requested
        scope.generation
      : // use latest generation by default
        keys.length - 1

  return keys[generation]
}
