import { type KeyScope } from '@localfirst/crdx'
import { type Lockbox } from '../../lockbox/index.js'
import { type Transform } from '../types.js'

/** How a scope is named in `state.keyHistory` */
export const keyHistoryKey = ({ type, name }: KeyScope) => `${type}:${name}`

export const collectLockboxes =
  (newLockboxes?: Lockbox[]): Transform =>
  state => {
    if (!newLockboxes) return state

    // Record any keyset this link introduces for a scope. The position a keyset takes in this list
    // is assigned by the graph, in the order links are replayed, and a link can only ever add to
    // the end of it — which is what makes it something a rotation can count from. See
    // `Team.rotateKeys`.
    const keyHistory = { ...state.keyHistory }
    for (const { contents } of newLockboxes) {
      const key = keyHistoryKey(contents)
      const seen = keyHistory[key] ?? []
      if (!seen.includes(contents.publicKey)) keyHistory[key] = [...seen, contents.publicKey]
    }

    return { ...state, lockboxes: state.lockboxes.concat(newLockboxes), keyHistory }
  }
