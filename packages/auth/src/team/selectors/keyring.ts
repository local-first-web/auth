import { type KeysetWithSecrets, createKeyring, type KeyScope } from '@localfirst/crdx'
import { KeyType } from '../../util/types.js'
import { isRegisteredEncryptionKey } from '../registeredEncryptionKeys.js'
import { type TeamState } from '../types.js'
import { keyMap } from './keyMap.js'

/**
 * Returns a keyring containing all generations of keys for the given scope.
 *
 * For a scope that IS somebody — a member or a server — only keysets the team registered for them
 * are included. A keyring is built from whatever lockboxes a device can open, and anyone can post a
 * lockbox naming somebody else's scope, so without this the keyring carries keysets its author
 * chose. `getDeviceUserFromGraph` takes a joining device's own user keys out of this keyring, which
 * means the signature secret it will sign links with: measured, a lockbox holding a minted keyset
 * addressed to an outstanding invitation's ephemeral key (`USER -> EPHEMERAL`, an honest pairing,
 * and the invitation's public key is plaintext on the graph) made the joining device adopt it.
 *
 * TEAM and ROLE scopes have no such record — the lockboxes are the record — so those are returned
 * as found. See `docs/internals.md`.
 */
export const keyring = (state: TeamState, scope: KeyScope, keys: KeysetWithSecrets) => {
  const allKeys = keyMap(state, keys)[scope.type]?.[scope.name]
  if (allKeys === undefined) return createKeyring([])

  const isSomebody = scope.type === KeyType.USER || scope.type === KeyType.SERVER
  const usable = [...allKeys.values()].filter(
    keyset =>
      !isSomebody || isRegisteredEncryptionKey(state, scope.name, keyset.encryption.publicKey)
  )

  return createKeyring(usable)
}
