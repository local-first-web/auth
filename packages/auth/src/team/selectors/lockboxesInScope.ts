import { type KeyScope } from '@localfirst/crdx'
import { type Lockbox } from '../../lockbox/index.js'
import { ADMIN } from '../../role/index.js'
import { KeyType } from '../../util/types.js'
import { memberHasRole } from './memberHasRole.js'
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
    if (!isEntitledTo(state, recipient, scope)) continue

    const key = recipientKey(lockbox)
    const latest = latestForEachRecipient.get(key)
    if (latest === undefined || contents.generation > latest.contents.generation) {
      latestForEachRecipient.set(key, lockbox)
    }
  }

  return [...latestForEachRecipient.values()]
}

/**
 * Whether this lockbox hands a scope to a holder entitled to it.
 *
 * A lockbox is a grant, and a grant has two halves that have to agree: the scope it hands over, and
 * the holder it hands it to. Both halves are fields its author wrote, so both have to be checked,
 * and the second one has to be checked BY NAME.
 *
 * The identity half — is this holder who the manifest says — was the subject of several earlier
 * rounds, and it is the first thing each branch below does. It is not enough on its own. An
 * attacker using their OWN registered device or their OWN user keys as the recipient passes every
 * identity check there is, because nothing about them is forged; the only lie is which scope the
 * contents name. Measured, comparing against the victim's actual re-keyed secret rather than
 * against "can they open something naming her scope": a lockbox naming Alice's USER scope,
 * addressed to Bob's own device or his own user keys, put him in her rotation set and delivered her
 * new secret to him. A door rule checking the contents TYPE didn't see it — its message named the
 * invariant ("only ever handed the keys of the user it belongs to") that the code never enforced.
 *
 * So each branch names the relation that entitles that holder to that scope:
 *
 * | contents | recipient   | relation                                    |
 * | -------- | ----------- | ------------------------------------------- |
 * | TEAM     | USER        | any member                                  |
 * | TEAM     | SERVER      | any server                                  |
 * | ROLE r   | USER        | a member who is IN role r                   |
 * | ROLE r   | ROLE        | the recipient role is ADMIN                 |
 * | USER u   | DEVICE      | u's OWN device                              |
 * | USER u   | EPHEMERAL   | u's OWN invitation                          |
 * | USER     | USER        | not an honest pairing — refused             |
 *
 * Anything not in that table is refused, so a pairing honest code never produces cannot be used.
 */
const isEntitledTo = (state: TeamState, recipient: Lockbox['recipient'], scope: KeyScope) => {
  const { type, name, publicKey } = recipient

  switch (type) {
    case KeyType.USER: {
      // Identity: the team's record of this member says which key is theirs
      const member = state.members.find(m => m.userId === name)
      if (member?.keys.encryption !== publicKey) return false

      // Relation: every member holds the team keys; a role's keys only if they're in that role.
      // Measured before this: a member who was not in the role collected its rotated keys.
      if (scope.type === KeyType.TEAM) return true
      if (scope.type === KeyType.ROLE) return memberHasRole(state, name, scope.name)
      return false
    }

    case KeyType.SERVER: {
      const server = state.servers.find(s => s.host === name)
      if (server?.keys.encryption !== publicKey) return false

      // A server is given the team keys so it can relay the graph. It never has roles —
      // `castServer.toMember` gives it `roles: []` — so nothing else is its business.
      return scope.type === KeyType.TEAM
    }

    case KeyType.DEVICE: {
      const owner = state.members.find(m => m.devices?.some(d => d.deviceId === name))
      const device = owner?.devices?.find(d => d.deviceId === name)
      if (device?.keys.encryption !== publicKey) return false

      // Relation: a device is handed ITS OWN user's keys, and nothing else. This is the invariant
      // the type-only door rule claimed and didn't check.
      return scope.type === KeyType.USER && scope.name === owner!.userId
    }

    case KeyType.ROLE: {
      // Identity: the role exists, and the manifest carries the keyset `keyHistory` carries last
      // for it — which is what `select.keys` resolves to
      if (!state.roles.some(r => r.roleName === name)) return false
      const carried = state.keyHistory[`${type}:${name}`] ?? []
      if (carried.at(-1) !== publicKey) return false

      // Relation: the admin role is the one role that holds every other role's keys. Measured
      // before this: a lockbox naming one role, addressed to another the author belonged to,
      // delivered the first role's rotated keys to the second.
      return scope.type === KeyType.ROLE && name === ADMIN
    }

    case KeyType.EPHEMERAL: {
      // Identity: the ear the reducer recorded on the link that posted the invitation — NOT "the
      // earliest lockbox naming this invitation's signature key". Position in the replayed graph is
      // settled by the resolver, whose input includes a `prev` its author chose. The key it is
      // looked up by is unique because `invitationsCanOnlyBePostedOnce` requires it to be.
      const { signature } = recipient as { signature?: string }
      if (signature === undefined) return false
      const invitation = Object.values(state.invitations).find(i => i.publicKey === signature)
      if (invitation?.earPublicKey !== publicKey) return false

      // Relation: an ear exists so a new device can pick up ITS OWN member's keys
      return (
        invitation.kind === 'DEVICE' &&
        scope.type === KeyType.USER &&
        scope.name === invitation.userId
      )
    }

    default: {
      return false
    }
  }
}

/** What makes two lockboxes' recipients the same holder */
const recipientKey = ({ recipient }: Lockbox) =>
  recipient.type === KeyType.EPHEMERAL
    ? `${recipient.type}:${recipient.publicKey}`
    : `${recipient.type}:${recipient.name}`
