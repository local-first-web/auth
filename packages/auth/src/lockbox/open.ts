import { memoize } from '@localfirst/shared'
import { type KeysetWithSecrets } from '@localfirst/crdx'
import { asymmetric } from '@localfirst/crypto'
import { type KeyManifest, type Lockbox } from './types.js'

/**
 * Opens a lockbox, if these are the keys that open it and what's inside is what the lockbox says
 * it is. Otherwise returns `undefined` — this device has no keys from this lockbox.
 *
 * A lockbox's payload is ciphertext addressed to one recipient, so no peer but that recipient can
 * see what it unpacks to, and no check at the door can say whether it holds a keyset. Anyone who
 * can post a link can post a lockbox, and the manifests they're filed under are plaintext to copy.
 * So the only place this can be answered is here, on the way out.
 *
 * Handing whatever came out onward was a permanent, one-target brick. Three measured payloads, all
 * from a non-admin, all reaching the victim through `visibleKeys`:
 *
 * - Bytes that aren't a cipher: `Data read, but end of buffer not reached`, out of msgpack.
 * - A cipher over something that isn't a keyset: `Cannot destructure property 'publicKey' of
 *   'keyset.encryption'`, out of `visibleKeys`' own recursion.
 * - A keyset carrying a BigInt: `Do not know how to serialize a BigInt`, out of a `JSON.stringify`
 *   in `select.keys`.
 *
 * Each one survived a restart, because the throw is raised replaying a link that's on the graph:
 * the victim's own `save()` wouldn't reload, and it reached them through `Team`'s `updated`
 * subscriber, after the merge had already been committed.
 *
 * What's checked is that the payload is a keyset with every field the things downstream reach for,
 * of the type they expect — and that it's the keyset the lockbox's own manifest describes. That
 * second half is what ties the ciphertext to the public part: `create` builds the manifest by
 * redacting the contents, so scope, generation and public key agree on every honest lockbox, and
 * the checks the door does make on the manifest carry over to what comes out.
 */
export const open = memoize(
  (lockbox: Lockbox, decryptionKeys: KeysetWithSecrets): KeysetWithSecrets | undefined => {
    const { encryptionKey, encryptedPayload, contents } = lockbox

    let decrypted: unknown
    try {
      decrypted = asymmetric.decryptBytes({
        cipher: encryptedPayload,
        senderPublicKey: encryptionKey.publicKey,
        recipientSecretKey: decryptionKeys.encryption.secretKey,
      })
    } catch {
      // Not a cipher, not a cipher we can open, or not msgpack — either way, no keys for us here
      return undefined
    }

    return isTheKeysetDescribedBy(contents)(decrypted) ? decrypted : undefined
  }
)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

const isKeypair = (value: unknown): value is { publicKey: string; secretKey: string } =>
  typeof value === 'object' &&
  value !== null &&
  isNonEmptyString((value as Record<string, unknown>).publicKey) &&
  isNonEmptyString((value as Record<string, unknown>).secretKey)

/**
 * A keyset every consumer of `visibleKeys` can take, filed where its manifest says to file it.
 *
 * `generation` has to be a plain non-negative integer because `keyMap` uses it as an array index
 * and `keys` counts on it to find the latest — and because it's the field a BigInt arrived on. It
 * also has to agree with the manifest, which bounds it: the manifest goes through the door, where
 * `isUsableGeneration` has already had its say about it.
 */
const isTheKeysetDescribedBy =
  (manifest: KeyManifest) =>
  (value: unknown): value is KeysetWithSecrets => {
    if (typeof value !== 'object' || value === null) return false
    const { type, name, generation, secretKey, encryption, signature } = value as Record<
      string,
      unknown
    >

    const isWellFormed =
      isNonEmptyString(type) &&
      isNonEmptyString(name) &&
      isNonEmptyString(secretKey) &&
      typeof generation === 'number' &&
      Number.isSafeInteger(generation) &&
      generation >= 0 &&
      isKeypair(encryption) &&
      isKeypair(signature)
    if (!isWellFormed) return false

    return (
      type === manifest.type &&
      name === manifest.name &&
      generation === manifest.generation &&
      (encryption as { publicKey: string }).publicKey === manifest.publicKey
    )
  }
