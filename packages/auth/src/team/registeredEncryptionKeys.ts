import { type Base58 } from '@localfirst/crdx'
import { type TeamState } from './types.js'

/**
 * Whether the given encryption key is one the team has registered for this member or server.
 *
 * Members' keys rotate, and a link stays valid under the generation it was authored with, so this
 * accepts any generation the team has ever registered for them — not just the current one.
 *
 * "Registered" means the team put it on this member: it was their keyset in `state.members` at some
 * point, which only happens through an action that cleared the rules for it. It does NOT mean
 * "appears somewhere on a lockbox". This used to scan lockbox manifests for one scoped to the
 * member, which is what `linkAuthorshipIsAuthentic` then rested on — and a manifest is plaintext,
 * written by whoever posted the lockbox, and proves nothing about who holds the key it names. One
 * lockbox whose contents manifest read `{type: USER, name: <victim>, publicKey: <mine>}` was enough
 * to author links in the victim's name that every peer accepted, the victim's own client included.
 */
export const isRegisteredEncryptionKey = (
  /** Team state as of the point in the chain we're asking about */
  state: TeamState,
  /** The userId of a member, or the host of a server */
  userId: string,
  /** The encryption public key to look for */
  publicKey: Base58
) => {
  // Whatever generation is current for them right now covers all but the rotation case
  const member =
    state.members.find(m => m.userId === userId) ??
    state.removedMembers.find(m => m.userId === userId)
  if (member?.keys.encryption === publicKey) return true

  const server =
    state.servers.find(s => s.host === userId) ?? state.removedServers.find(s => s.host === userId)
  if (server?.keys.encryption === publicKey) return true

  // Otherwise, any generation the team registered for them earlier
  return (state.registeredKeys[userId] ?? []).includes(publicKey)
}

/**
 * Every encryption public key the team has ever registered for each member or server, indexed by
 * userId (or host).
 */
export const registeredEncryptionKeys = (state: TeamState) => {
  const keys = new Map<string, Set<Base58>>()

  const record = (name: string, publicKey: Base58) => {
    const keysForName = keys.get(name) ?? new Set<Base58>()
    keysForName.add(publicKey)
    keys.set(name, keysForName)
  }

  // The current keys of everyone who is or was on the team
  for (const member of [...state.members, ...state.removedMembers])
    record(member.userId, member.keys.encryption)
  for (const server of [...state.servers, ...state.removedServers])
    record(server.host, server.keys.encryption)

  // ...and every generation the team registered for them before that
  for (const [name, publicKeys] of Object.entries(state.registeredKeys))
    for (const publicKey of publicKeys) record(name, publicKey)

  return keys
}
