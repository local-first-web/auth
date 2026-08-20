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
 *
 * Where two lockboxes for one holder name the same generation, the first on the graph is kept.
 * Every tiebreak richer than that is one an author can write to their own advantage, since both
 * manifests are theirs to fill in, and no honest flow was found that produces such a tie.
 */
export const lockboxesInScope = (state: TeamState, scope: KeyScope): Lockbox[] => {
  const latestForEachRecipient = new Map<string, Lockbox>()

  for (const lockbox of state.lockboxes) {
    const { contents, recipient } = lockbox
    if (contents.type !== scope.type || contents.name !== scope.name) continue
    if (!isAHolderTheTeamKnows(state, recipient)) continue

    const key = recipientKey(lockbox)
    const latest = latestForEachRecipient.get(key)
    if (latest === undefined || contents.generation > latest.contents.generation) {
      latestForEachRecipient.set(key, lockbox)
    }
  }

  return [...latestForEachRecipient.values()]
}

/**
 * Whether this lockbox is addressed to a holder the team can vouch for.
 *
 * `recipient.name` says who a lockbox is for and `recipient.publicKey` decides who can actually
 * open it, and nothing tied them together — both are fields its author wrote. So a lockbox naming
 * the victim while carrying somebody else's public key joined the victim's group here, and if it
 * claimed a higher `contents.generation` it won the group; the rotation then addressed the
 * victim's replacement to the other key. Measured: the victim goes on being a member and silently
 * stops receiving rotated keys, and a second rotation doesn't get them back either.
 *
 * For the recipient kinds the team keeps a record of — members, servers, devices — the record is
 * what says which key is theirs, so a manifest that disagrees isn't their lockbox. A name the team
 * has no record of isn't a holder either: without this, rotation would hand new keys to whatever
 * key a made-up name carried.
 *
 * ROLE and EPHEMERAL recipients have no such record. A role's keys are only ever in lockboxes, and
 * an invitation's starter keys are derived from a seed that never touches the graph — so those are
 * still taken at face value, and are listed as unfinished in `docs/internals.md`.
 */
const isAHolderTheTeamKnows = (state: TeamState, recipient: Lockbox['recipient']) => {
  const { type, name, publicKey } = recipient

  // A role's keys live only in lockboxes, but the graph still says which keyset is the role's: it
  // is the one `keyHistory` carries last for that scope, which is what `select.keys` resolves to.
  // A manifest naming `ROLE:admin` while carrying its author's own key used to win that group, and
  // then `removeMemberRole` rotated a role whose real holder was no longer in the set — measured,
  // the keyset didn't change at all.
  if (type === KeyType.ROLE) {
    if (!state.roles.some(r => r.roleName === name)) return false
    const carried = state.keyHistory[`${type}:${name}`] ?? []
    return carried.at(-1) === publicKey
  }

  // An invitation's starter keys never touch the graph, but the reducer records the ear it was
  // posted with, on the link that posted it. That is what an ear has to match — NOT "the earliest
  // lockbox naming this invitation's signature key". Position in the replayed graph is settled by
  // the resolver, and the resolver's input includes a `prev` its author chose, so someone who
  // learns the signature key from the public invitation link can post an ear of their own on an
  // older head and come out first. See `postInvitation`, and `docs/internals.md` on why an ordering
  // is not a graph-assigned quantity.
  if (type === KeyType.EPHEMERAL) {
    const { signature } = recipient as { signature?: string }
    if (signature === undefined) return false
    const invitation = Object.values(state.invitations).find(i => i.publicKey === signature)
    return invitation?.earPublicKey === publicKey
  }

  const attested =
    type === KeyType.USER
      ? state.members.find(m => m.userId === name)?.keys.encryption
      : type === KeyType.SERVER
        ? state.servers.find(s => s.host === name)?.keys.encryption
        : state.members.flatMap(m => m.devices ?? []).find(d => d.deviceId === name)?.keys
            .encryption

  return attested !== undefined && attested === publicKey
}

/** What makes two lockboxes' recipients the same holder */
const recipientKey = ({ recipient }: Lockbox) =>
  recipient.type === KeyType.EPHEMERAL
    ? `${recipient.type}:${recipient.publicKey}`
    : `${recipient.type}:${recipient.name}`
