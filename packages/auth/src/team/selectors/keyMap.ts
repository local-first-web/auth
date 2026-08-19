import { type KeysetWithSecrets } from '@localfirst/crdx'
import { visibleKeys } from './visibleKeys.js'
import { type TeamState } from '../types.js'

/** Returns all keysets from the current device's lockboxes in a structure that looks like this:
 * ```js
 * {
 *    TEAM: {
 *      TEAM: Map { 0 => gen0, 1 => gen1, 2 => gen2, ... },
 *    ROLE: {
 *      admin: Map { 0 => gen0, ... }
 *      managers: Map { 0 => gen0, ...}
 *    },
 *   USER: {
 *    alice: Map { 0 => gen0, ... }
 *   }
 * }
 * ```
 */
export const keyMap = (state: TeamState, deviceKeys: KeysetWithSecrets): KeyMap => {
  // Get all the keys those keys can access
  const allVisibleKeys = visibleKeys(state, deviceKeys)

  // Structure these keys as described above
  return allVisibleKeys.reduce(organizeKeysIntoMap, {})
}

/**
 * Files each keyset under its scope and generation.
 *
 * A generation is an identifier, not a position. This used to assign into an array at
 * `history[generation]`, which quietly meant something different for a generation that isn't an
 * array index: anything non-integral or at or above 2**32 became a string property, so the array's
 * length never grew and the "latest generation" resolved back to 0 — which is how a forged
 * `generation` of `0.5` or `2**40` defeated key rotation without a single error. It also made a
 * scope's history an array as long as its highest generation, so a lockbox naming a large one could
 * hand `createKeyring` an array with four billion holes to walk.
 *
 * The first keyset wins, not the last. Two lockboxes reaching one device for the same scope and
 * generation hold the same keyset if both are honest, so which one is kept can't matter on an
 * honest graph — but it decides everything on a graph where one of them isn't. Last-wins let any
 * member displace a scope's real keys with keys of their own, just by posting a later lockbox
 * naming the same generation: at generation 0, no forged number required.
 *
 * That's the half of auth-9sl that's closed here. What isn't: nothing stops a member from claiming
 * a generation the recipient doesn't have yet, and being first is automatic when nobody else has
 * ever named it.
 */
const organizeKeysIntoMap = (result: KeyMap, keys: KeysetWithSecrets) => {
  const { type, name, generation } = keys
  const keysetsForScope = result[type] ?? {}
  const keysetHistory = keysetsForScope[name] ?? new Map<number, KeysetWithSecrets>()
  if (!keysetHistory.has(generation)) keysetHistory.set(generation, keys)
  return {
    ...result,
    [type]: {
      ...keysetsForScope,
      [name]: keysetHistory,
    },
  } as KeyMap
}

export type KeysetHistory = Map<number, KeysetWithSecrets>

type KeyMap = Record<string, Record<string, KeysetHistory>>
