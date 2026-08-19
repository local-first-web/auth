import { type Base58 } from '@localfirst/crdx'
import { type Transform } from '../types.js'

/**
 * Records the encryption keys the team has registered for each member and server.
 *
 * A link stays valid under the generation it was authored with, so `linkAuthorshipIsAuthentic`
 * needs every generation the team has ever registered for someone, not just their current one.
 * That history used to be recovered by scanning lockbox MANIFESTS for one scoped to the member —
 * any of them, from anybody. A manifest is plaintext and written by whoever posted the lockbox, so
 * one lockbox whose contents manifest read `{type: USER, name: <victim>, publicKey: <mine>}`
 * registered a key of the author's own as the victim's, and from there its author could write
 * links in the victim's name that every peer accepted, the victim's own client included.
 *
 * The history comes instead from `state.members` and `state.servers`, which every generation of a
 * member's keys passes through on its way into state. That gives the record a closed set of
 * writers, and every one of them reduces to *this member, or an admin*:
 *
 * - `ADD_MEMBER` — `mustBeAdmin`
 * - `ADMIT_MEMBER` — the keyset is bound by the invitation proof, and `uniqueUserNameAndId` stops
 *   it naming a userId the team already has
 * - `CHANGE_MEMBER_KEYS` — `canOnlyChangeYourOwnKeys`
 * - the `removeDevice` transform, which promotes a manifest — `canOnlyRemoveYourOwnDevices`
 *
 * This runs after the action's own transforms, so it sees whatever they registered, and it keeps
 * everything it has seen: a removed member's keys still have to validate the links they authored
 * while they were a member.
 *
 * An earlier version of this also registered keys named by the lockboxes on the link itself, when
 * the link's author was that member or an admin. It was written for a case that turned out not to
 * need it — a removed member is recognised, and sees themselves as removed, without it — and no
 * test failed when it was deleted. What it did buy was an admin registering a key of their own as
 * another member's, silently, as a side effect of any admin-authored link carrying a USER-scoped
 * lockbox, and then writing links in that member's name that the audit trail could not tell from
 * their own. An admin who can remove a member gains nothing by removing them as somebody else
 * except deniability, which is the property `auditAuthorship` exists to provide. It was also the
 * one writer above that didn't reduce to self-or-admin-on-the-record.
 */
export const recordRegisteredKeys = (): Transform => state => {
  const registeredKeys = { ...state.registeredKeys }
  let changed = false

  const record = (name: string, publicKey: Base58) => {
    const known = registeredKeys[name]
    if (known === undefined) {
      registeredKeys[name] = [publicKey]
      changed = true
    } else if (!known.includes(publicKey)) {
      registeredKeys[name] = [...known, publicKey]
      changed = true
    }
  }

  for (const member of state.members) record(member.userId, member.keys.encryption)
  for (const server of state.servers) record(server.host, server.keys.encryption)

  return changed ? { ...state, registeredKeys } : state
}
