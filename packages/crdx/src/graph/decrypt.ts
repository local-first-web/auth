import { asymmetric } from '@localfirst/crypto'
import { hashEncryptedLink } from './hashLink.js'
import {
  type Action,
  type EncryptedLink,
  type Graph,
  type Link,
  type LinkBody,
  type MaybePartlyDecryptedGraph,
} from './types.js'
import { createKeyring } from 'keyset/createKeyring.js'
import { type Keyring, type KeysetWithSecrets } from 'keyset/index.js'
import { type Hash } from 'util/index.js'
import { assert } from '@localfirst/shared'

/**
 * Decrypts a single link of a graph, given the graph keys at the time the link was authored.
 */
export const decryptLink = <A extends Action, C>(
  encryptedLink: EncryptedLink,
  keys: Keyring | KeysetWithSecrets | KeysetWithSecrets[]
): Link<A, C> => {
  const { senderPublicKey, recipientPublicKey, encryptedBody } = encryptedLink

  const keyring = createKeyring(keys)
  const keyset = keyring[recipientPublicKey]
  assert(keyset, `Can't decrypt link: don't have the correct keyset`)

  const cipher = toUint8Array(encryptedBody)

  const decryptedLinkBody = asymmetric.decryptBytes({
    cipher,
    recipientSecretKey: keyset.encryption.secretKey,
    senderPublicKey,
  }) as LinkBody<A, C>

  return {
    hash: hashEncryptedLink(encryptedBody),
    body: decryptedLinkBody,
  }
}

/**
 * Decrypts a graph using a one or more keys.
 */
export const decryptGraph: DecryptFn = <A extends Action, C>({
  encryptedGraph,
  keys,
}: {
  encryptedGraph: MaybePartlyDecryptedGraph<A, C>
  keys: KeysetWithSecrets | KeysetWithSecrets[] | Keyring
}): Graph<A, C> => {
  const { encryptedLinks, root, childMap = {} } = encryptedGraph
  const links = encryptedGraph.links ?? {}
  const toVisit = [root]
  const visited: Set<Hash> = new Set()
  const decryptedLinks: Record<Hash, Link<A, C>> = {}

  while (toVisit.length > 0) {
    const current = toVisit.pop() as Hash

    if (visited.has(current)) {
      continue
    }

    const encryptedLink = encryptedLinks[current]
    const decryptedLink =
      links[current] ?? // if it's already decrypted, don't bother decrypting it again
      decryptLink(encryptedLink, keys)

    decryptedLinks[current] = decryptedLink

    const children = childMap[current] ?? []
    for (const child of children) {
      toVisit.push(child)
    }
    visited.add(current)
  }

  return {
    ...encryptedGraph,
    links: decryptedLinks,
  }
}

export type DecryptFnParams<A extends Action, C> = {
  encryptedGraph: MaybePartlyDecryptedGraph<A, C>
  keys: KeysetWithSecrets | KeysetWithSecrets[] | Keyring
}

export type DecryptFn = <A extends Action, C>({
  encryptedGraph,
  keys,
}: DecryptFnParams<A, C>) => Graph<A, C>

// ignore coverage
// buffer to uint8array
const toUint8Array = (buf: globalThis.Buffer | Uint8Array) => {
  return !isBuffer(buf)
    ? new Uint8Array(buf)
    : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

const isBuffer = (buf: globalThis.Buffer | Uint8Array): buf is globalThis.Buffer =>
  'buffer' in buf && 'byteOffset' in buf && 'byteLength' in buf
