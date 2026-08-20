import { type KeyMetadata, type KeyScope, type KeysetWithSecrets } from '@localfirst/crdx'
import { keyMap, type KeysetHistory } from './keyMap.js'
import { keyHistoryKey } from '../transforms/collectLockboxes.js'
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
      : // Use the current generation by default
        currentGeneration(state, scope, keys)

  const found = generation === undefined ? undefined : keys.get(generation)
  assert(
    found,
    `Couldn't find keys the team issued: ${type}:${name}
     Device: ${deviceKeys.name}
     Keys this device can see: ${summarize(keysFromLockboxes)}`
  )
  return found
}

/**
 * Which generation of this scope is the current one, decided by the graph rather than by a number
 * on a lockbox.
 *
 * A keyset's `generation` is a field inside a lockbox, so it is whatever its author wrote. Taking
 * the highest one the device holds made "current" an assertion anybody could make: a member who
 * put a keyset of their own in a lockbox and called it generation 9 became the answer, and stayed
 * the answer — a rotation numbers its replacement from `keyHistory.length`, which is small, so the
 * honest keyset came out BELOW the forgery and never became current. Measured: after a forgery at
 * generation 9, rotating the role twice left it still reading the forger's keyset. That made the
 * documented remediation — rotate the scope — do nothing, and it applied to the team keys as much
 * as to a role's.
 *
 * `state.keyHistory` is the one quantity here the graph assigns rather than the author: the reducer
 * appends a scope's keyset the first time the graph carries it, in replay order, so its position is
 * not something a payload can claim. The current keyset is the last one in that order that this
 * device actually holds — which on a graph with nothing forged on it is the highest generation,
 * exactly as before, because each rotation appends the next one.
 *
 * Two things this deliberately does not do. It does not stop a forged keyset from BEING current
 * before anyone rotates: an author can append to the history, one slot per lockbox they post, and
 * the newest entry wins. That is auth-9sl, still open. And it does not decide between two keysets
 * claiming the SAME generation — `keyMap` keeps the first it sees, so a forgery colliding with a
 * generation the device already holds never reaches this list at all.
 */
const currentGeneration = (state: TeamState, scope: KeyScope, held: KeysetHistory) => {
  const generationOf = new Map<string, number>()
  for (const [generation, keyset] of held) generationOf.set(keyset.encryption.publicKey, generation)

  const assignedByTheGraph = state.keyHistory[keyHistoryKey(scope)] ?? []
  for (let i = assignedByTheGraph.length - 1; i >= 0; i--) {
    const generation = generationOf.get(assignedByTheGraph[i])
    if (generation !== undefined) return generation
  }

  // Nothing this device holds for the scope is a keyset the graph carried, so the team never
  // issued any of them to it. Falling back to the highest generation held used to hand one back
  // anyway, and that is the whole of `auth-uvp`: an invitee holds exactly one TEAM keyset — the one
  // whoever admitted them put in their first lockbox — so the fallback returned it however it got
  // there. Answering "none" lets `keys` refuse, which is what an invitee handed a keyset the team
  // never had should hear.
  return undefined
}

/** Which scopes this device recovered keys for, and which generations of each — no secrets */
const summarize = (keysFromLockboxes: Record<string, Record<string, KeysetHistory>>) =>
  Object.entries(keysFromLockboxes)
    .flatMap(([type, byName]) =>
      Object.entries(byName).map(
        ([name, history]) => `${type}:${name}#${[...history.keys()].join(',')}`
      )
    )
    .join(', ')
