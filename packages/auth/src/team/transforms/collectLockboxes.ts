import { type Base58, type KeyScope } from '@localfirst/crdx'
import { type Lockbox } from '../../lockbox/index.js'
import { type Transform } from '../types.js'

/** How a scope is named in `state.keyHistory` */
export const keyHistoryKey = ({ type, name }: KeyScope) => `${type}:${name}`

export const collectLockboxes =
  (newLockboxes?: Lockbox[], mayIntroduceKeysets = true): Transform =>
  state => {
    if (!newLockboxes) return state

    // Record any keyset this link introduces for a scope. The position a keyset takes in this list
    // is assigned by the graph, in the order links are replayed, and a link can only ever add to
    // the end of it — which is what makes it something a rotation can count from. See
    // `Team.rotateKeys`.
    //
    // A payload can name any number of lockboxes, and a peer pays for this on every replay of the
    // link, forever — so the whole call is one pass. Asking an array whether it already holds a
    // key, and copying it to add one, each cost a scan of the scope's history, which made a link
    // carrying n lockboxes cost O(n²): measured at 30,000 on one link, 3.3s to merge and 10.9s to
    // load, every time. The membership test is a `Set` built once per scope, and each scope's
    // history is rebuilt once at the end rather than once per key.
    const seenByScope = new Map<string, Set<Base58>>()
    const addedByScope = new Map<string, Base58[]>()

    for (const { contents } of newLockboxes) {
      const key = keyHistoryKey(contents)
      let seen = seenByScope.get(key)
      if (seen === undefined) {
        seen = new Set(state.keyHistory[key])
        seenByScope.set(key, seen)
      }

      // An admission hands the new member keys the team already has; it does not issue any. So a
      // keyset that first appears on one is not a keyset the team ever had — see `auth-uvp`, where
      // a non-admin admitting an invitee put a keyset of their own in the invitee's first TEAM
      // lockbox, and the invitee resolved `TEAM:TEAM` to it because being first is all
      // `keyMap`'s tie rule asks for and a brand-new member has nothing older to prefer. Letting
      // the link through but not letting it write here is deliberate: a refusal would be a graph
      // nobody could replay, and a concurrent rotation that the resolver discards would then be
      // able to brick an honest admission.
      if (!mayIntroduceKeysets) continue

      if (!seen.has(contents.publicKey)) {
        seen.add(contents.publicKey)
        const added = addedByScope.get(key)
        if (added === undefined) addedByScope.set(key, [contents.publicKey])
        else added.push(contents.publicKey)
      }
    }

    // `clone` is shallow, so the histories of scopes this link didn't touch stay shared rather than
    // being copied — only the ones that grew are rebuilt
    const keyHistory = { ...state.keyHistory }
    for (const [key, added] of addedByScope)
      keyHistory[key] = [...(state.keyHistory[key] ?? []), ...added]

    return { ...state, lockboxes: state.lockboxes.concat(newLockboxes), keyHistory }
  }
