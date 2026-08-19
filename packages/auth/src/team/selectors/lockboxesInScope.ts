import { type KeyScope } from '@localfirst/crdx'
import { type Lockbox } from '../../lockbox/index.js'
import { KeyType } from '../../util/types.js'
import { type TeamState } from '../types.js'

/**
 * Returns the most recent lockbox holding keys for the given scope, for each recipient that has
 * one.
 *
 * This is the list `Team.rotateKeys` replaces: it makes exactly one new lockbox per lockbox this
 * returns, so anyone left out of the answer silently stops receiving the scope's keys from here on.
 *
 * It used to answer with the single highest generation present and nothing else, which put that
 * decision in the hands of one number on a plaintext manifest. Any member could attach a lockbox
 * saying `generation: 3` to any link they were entitled to post — an ADD_DEVICE for a device of
 * their own does it — and from then on they were the only recipient rotation could see. Removals
 * went on reporting success while the team keys never moved, and the removed member went on reading
 * everything posted afterwards. No shape check can tell that lockbox from an honest one, because a
 * forged `3` is a `3`.
 *
 * Grouping by recipient takes the number out of that decision. A lockbox can still say whatever it
 * likes about its own generation, but it can only ever speak for the recipient it's addressed to:
 * every other holder of the scope's keys is still in the answer, and still gets a replacement.
 *
 * The recipient is identified by scope rather than by public key, because a recipient's own keys
 * get rotated too, and the superseded generations of their lockboxes stay on the graph forever —
 * keying on the public key would hand rotation the same recipient several times over. Ephemeral
 * recipients are the exception: every keyset minted from an invitation seed is named EPHEMERAL, so
 * a team with two invitations outstanding has two distinct holders under one name, and it's the
 * public key that tells them apart.
 *
 * The generation the replacements carry is not each old lockbox's own; `Team.rotateKeys` settles
 * one generation for the whole scope, so that a lockbox claiming to be ahead can't split a scope
 * into recipients holding the same keys under different numbers.
 */
export const lockboxesInScope = (state: TeamState, scope: KeyScope): Lockbox[] => {
  const latestForEachRecipient = new Map<string, Lockbox>()

  for (const lockbox of state.lockboxes) {
    const { contents } = lockbox
    if (contents.type !== scope.type || contents.name !== scope.name) continue

    const key = recipientKey(lockbox)
    const latest = latestForEachRecipient.get(key)
    if (latest === undefined || isNewerThan(lockbox, latest)) {
      latestForEachRecipient.set(key, lockbox)
    }
  }

  return [...latestForEachRecipient.values()]
}

/** What makes two lockboxes' recipients the same holder */
const recipientKey = ({ recipient }: Lockbox) =>
  recipient.type === KeyType.EPHEMERAL
    ? `${recipient.type}:${recipient.publicKey}`
    : `${recipient.type}:${recipient.name}`

/**
 * Later contents win; where two lockboxes hold the same generation of the scope's keys, the one
 * addressed to the recipient's later keys wins, so that a rotation doesn't hand a replacement to a
 * superseded generation of the recipient's own keyset.
 */
const isNewerThan = (a: Lockbox, b: Lockbox) =>
  a.contents.generation === b.contents.generation
    ? a.recipient.generation > b.recipient.generation
    : a.contents.generation > b.contents.generation
