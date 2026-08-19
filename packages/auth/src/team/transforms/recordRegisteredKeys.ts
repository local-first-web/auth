import { type Base58 } from '@localfirst/crdx'
import { type Lockbox } from '../../lockbox/index.js'
import { KeyType } from '../../util/types.js'
import { type Transform } from '../types.js'

/**
 * Records the encryption keys the team has registered for each member and server.
 *
 * A link stays valid under the generation it was authored with, so `linkAuthorshipIsAuthentic`
 * needs every generation the team has ever registered for someone, not just their current one.
 * That history used to be recovered by scanning lockbox MANIFESTS for one scoped to the member —
 * any of them, from anybody. A manifest is plaintext and written by whoever posted the lockbox, so
 * one lockbox whose contents manifest read `{type: USER, name: <victim>, publicKey: <mine>}`
 * registered a key of the author's own as the victim's. From there the author could write links in
 * the victim's name that every peer accepted, the victim's own client and an admin's included.
 *
 * Two sources now, and the author of a link can write to neither of them freely.
 *
 * The first is `state.members` and `state.servers`: every generation of a member's keys passes
 * through there, and only via an action that cleared the rules — `mustBeAdmin` for an added member,
 * a proof bound to the keyset for an admitted one, `canOnlyChangeYourOwnKeys` for a re-key.
 *
 * The second is the lockboxes on this link, and it is needed because not every keyset the team
 * issues for a member reaches `state.members`. Removing a member rotates their user keys, and the
 * new keyset exists only in the lockboxes that removal posts — the removed member picks it up from
 * their own device and authors with it, and we have to know it is theirs to be able to tell them
 * they were removed rather than that we can't place them. So a lockbox naming someone's scope
 * registers a key for them when its link was authored by someone entitled to set their keys: by
 * that member themselves, or by an admin. That is the same rule `canOnlyChangeYourOwnKeys` applies
 * to a re-key, applied to the other way keys reach a member.
 *
 * This runs after the action's own transforms, so it sees whatever they registered. It keeps
 * everything it has seen: a removed member's keys still have to validate the links they authored
 * while they were a member.
 */
export const recordRegisteredKeys =
  ({
    author,
    authorCanSetOthersKeys,
    lockboxes = [],
  }: {
    /** userId the link is attributed to */
    author: string
    /** Whether that author was an admin as of the previous state */
    authorCanSetOthersKeys: boolean
    /** Lockboxes this link carries */
    lockboxes?: Lockbox[]
  }): Transform =>
  state => {
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

    for (const { contents } of lockboxes) {
      const isSomeonesOwnScope = contents.type === KeyType.USER || contents.type === KeyType.SERVER
      if (!isSomeonesOwnScope) continue
      if (authorCanSetOthersKeys || contents.name === author)
        record(contents.name, contents.publicKey)
    }

    return changed ? { ...state, registeredKeys } : state
  }
