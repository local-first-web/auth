import { type Base58 } from '@localfirst/crdx'
import { KeyType } from 'util/index.js'
import { type TeamState } from './types.js'

const { USER, SERVER } = KeyType

/**
 * Whether the given encryption key is one the team has registered for this member or server.
 *
 * Members' keys rotate, and a link stays valid under the generation it was authored with, so this
 * accepts any generation the team has ever registered for them — not just the current one.
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

  // Otherwise look for any generation ever lockboxed to or from them
  for (const { contents, recipient } of state.lockboxes)
    for (const manifest of [contents, recipient])
      if (isScopedTo(manifest.type, userId, manifest.name) && manifest.publicKey === publicKey)
        return true

  return false
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

  // Every generation that has ever been lockboxed to or from a member or server. Lockbox manifests
  // are unencrypted, so this recovers the earlier generations that rotation has since superseded.
  for (const { contents, recipient } of state.lockboxes)
    for (const manifest of [contents, recipient])
      if (manifest.type === USER || manifest.type === SERVER)
        record(manifest.name, manifest.publicKey)

  return keys
}

/** Whether a lockbox manifest belongs to the given member or server. */
const isScopedTo = (type: string, userId: string, name: string) =>
  (type === USER || type === SERVER) && name === userId
