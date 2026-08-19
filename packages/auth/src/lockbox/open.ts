import { memoize } from '@localfirst/shared'
import { type KeysetWithSecrets } from '@localfirst/crdx'
import { asymmetric, base58, hash } from '@localfirst/crypto'
import { type KeyManifest, type Lockbox } from './types.js'

/** Domain separator for the memo key below — this hash is a cache key, never a security claim */
const LOCKBOX_MEMO = 'LOCKBOX_MEMO'

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
 *
 * What this does NOT do is decide whether the keyset is the one the TEAM issued. Both halves are
 * satisfied by a keyset a member minted and described honestly, so a lockbox can still carry keys
 * of its author's own choosing under any scope and generation it likes. `keyMap` keeps the first
 * keyset it sees for a scope and generation, which stops that from displacing keys the recipient
 * already has; claiming a generation they don't have yet, or reaching a scope sooner than its
 * honest delivery does, is auth-9sl, and is still open. Rotating the scope recovers it — see
 * `docs/internals.md`.
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
  },
  // Both arguments decide the answer, so both have to be in the key. The default resolver uses only
  // the first, which was survivable while a wrong key threw — a throw isn't cached — and stopped
  // being survivable when a wrong key started returning `undefined`: one call with anybody else's
  // keys would answer for the real recipient from then on. Every plaintext field of a lockbox can
  // be copied onto another one, so the payload is what makes the key identify a lockbox.
  (lockbox, decryptionKeys) =>
    `${hash(LOCKBOX_MEMO, lockbox.encryptedPayload)}:${lockbox.contents.publicKey}:${
      lockbox.encryptionKey.publicKey
    }:${decryptionKeys.encryption.publicKey}`
)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

/**
 * A string libsodium can take as a key of this kind: base58, decoding to exactly this many bytes.
 *
 * Being a non-empty string is not enough, which is what an earlier version of this settled for.
 * `'notAKey'` is a non-empty string, and a keyset with `'notAKey'` in every secret is a keyset in
 * every respect these checks were asking about — it went into `keyMap`, came back out of
 * `teamKeys()`, and left the victim's saved graph unloadable. Every one of these fields is handed
 * to libsodium, which throws rather than refusing, so the length is part of what the field is.
 *
 * The lengths are what `createKeyset` produces: 32 bytes for the symmetric secret and for both
 * halves of the encryption keypair and the signature public key, 64 for the signature secret.
 */
const isUsableKey = (value: unknown, byteLength: number): value is string => {
  if (!isNonEmptyString(value)) return false
  // Decoding is quadratic in the length of the string, and base58 never encodes a byte as more than
  // two characters — so nothing of the right length is ruled out by bounding it first
  if (value.length > byteLength * 2) return false
  if (!base58.detect(value)) return false
  return base58.decode(value).length === byteLength
}

const isKeypair = (
  value: unknown,
  secretKeyBytes: number
): value is { publicKey: string; secretKey: string } =>
  typeof value === 'object' &&
  value !== null &&
  isUsableKey((value as Record<string, unknown>).publicKey, PUBLIC_KEY_BYTES) &&
  isUsableKey((value as Record<string, unknown>).secretKey, secretKeyBytes)

/** What `createKeyset` produces, in bytes */
const PUBLIC_KEY_BYTES = 32
const SYMMETRIC_KEY_BYTES = 32
const ENCRYPTION_SECRET_KEY_BYTES = 32
const SIGNATURE_SECRET_KEY_BYTES = 64

/**
 * A keyset every consumer of `visibleKeys` can take, filed where its manifest says to file it.
 *
 * Every field has to be a key libsodium could actually use, not merely a string — see `isUsableKey`.
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
      isUsableKey(secretKey, SYMMETRIC_KEY_BYTES) &&
      typeof generation === 'number' &&
      Number.isSafeInteger(generation) &&
      generation >= 0 &&
      isKeypair(encryption, ENCRYPTION_SECRET_KEY_BYTES) &&
      isKeypair(signature, SIGNATURE_SECRET_KEY_BYTES)
    if (!isWellFormed) return false

    return (
      type === manifest.type &&
      name === manifest.name &&
      generation === manifest.generation &&
      (encryption as { publicKey: string }).publicKey === manifest.publicKey
    )
  }
