import { type Base58 } from '@localfirst/crdx'

/**
 * A cycle guard for a walk over the lockbox graph.
 *
 * Lockboxes form a graph, not a tree. Honest ones only ever point away from their recipient, so a
 * walk over them terminates — but nothing enforces that, and any member can post
 * `create(k1, k2)` and `create(k2, k1)` on one link. Both are well formed, both hold exactly the
 * keyset their manifest describes, both are honest pairings that clear every check at the door.
 * A walk without a guard then recurses until `Maximum call stack size exceeded`, permanently,
 * because the lockboxes are on the graph.
 *
 * There are exactly two walks over this graph, and they are easy to mistake for each other:
 *
 * - `selectors/visibleKeys` — what keysets these keys can open, walking by encryption public key.
 * - `selectors/visibleScopes` — what scopes a scope can reach, walking by scope, over manifests
 *   only. `Team.rotateKeys` calls this one on every rotation.
 *
 * They were written as siblings and one of them got a guard. The other kept its own copy of the
 * hazard for two more rounds, which is how a member could make one chosen member impossible to
 * remove OR re-key — the team's only two remediations against a member, both gone, from three
 * lockboxes. Whatever else changes, both walks take their guard from here, so `grep` over this
 * name answers "which walks are guarded" in one look.
 */
export const cycleGuard = () => {
  const walked = new Set<string>()
  return {
    /** True if this node has been walked already — in which case don't walk it again */
    walkedAlready(id: Base58 | string) {
      if (walked.has(id)) return true
      walked.add(id)
      return false
    },
  }
}

export type CycleGuard = ReturnType<typeof cycleGuard>
