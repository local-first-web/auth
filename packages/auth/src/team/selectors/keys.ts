import { type KeyMetadata, type KeyScope, type KeysetWithSecrets } from '@localfirst/crdx'
import { keyMap, type KeysetHistory } from './keyMap.js'
import { type TeamState } from '../types.js'
import { assert } from '@localfirst/shared'
import { lockboxSummary } from '../../util/lockboxSummary.js'

/** Returns the keys for the given scope, if they are in a lockbox that the current device has access to */
export const keys = (
  state: TeamState,
  deviceKeys: KeysetWithSecrets,
  scope: KeyScope | KeyMetadata
) => {
  const { type, name } = scope

  const keysFromLockboxes = keyMap(state, deviceKeys)
  const keys = keysFromLockboxes[type] ? keysFromLockboxes[type][name] : undefined

  // The message is built here, on the way out, rather than passed to `assert` — an argument is
  // evaluated whether or not the assertion fires, so describing the failure was work every
  // successful lookup paid for, and any way of describing it that could throw was a way for a
  // successful lookup to throw. It used to `JSON.stringify` every keyset recovered from the
  // lockboxes, which meant a lockbox holding a BigInt broke every key lookup on the team. It also
  // meant secret keys in an error message, which is why the summary below names scopes and
  // generations instead.
  if (keys === undefined || keys.size === 0) {
    assert(
      false,
      `Couldn't find keys: ${type}:${name}
       Device: ${deviceKeys.name}
       Available lockboxes: \n- ${state.lockboxes.map(lockboxSummary).join('\n- ')}
       Keys this device can see: ${summarize(keysFromLockboxes)}`
    )
  }

  const generation =
    'generation' in scope && scope.generation !== undefined
      ? // Return specific generation if requested
        scope.generation
      : // Use latest generation by default
        latestGeneration(keys)

  return keys.get(generation)!
}

/**
 * The highest generation of this scope that the device actually holds.
 *
 * This used to be `history.length - 1`, which was only the latest generation while every generation
 * was a usable array index — and a `generation` is a number off a lockbox manifest, which anyone
 * who can post a link can choose. Asking the history what it holds says the same thing about an
 * honest scope and doesn't depend on that.
 */
const latestGeneration = (history: KeysetHistory) => Math.max(...history.keys())

/** Which scopes this device recovered keys for, and which generations of each — no secrets */
const summarize = (keysFromLockboxes: Record<string, Record<string, KeysetHistory>>) =>
  Object.entries(keysFromLockboxes)
    .flatMap(([type, byName]) =>
      Object.entries(byName).map(
        ([name, history]) => `${type}:${name}#${[...history.keys()].join(',')}`
      )
    )
    .join(', ')
