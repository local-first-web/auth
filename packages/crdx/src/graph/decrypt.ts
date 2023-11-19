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
import { assert, type Hash } from 'util/index.js'

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

  const decryptedLinkBody = asymmetric.decrypt({
    cipher: encryptedBody,
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

  /** Recursively decrypts a link and its children. */
  const decrypt = (
    hash: Hash,
    prevLinks: Record<Hash, Link<A, C>> = {}
  ): Record<Hash, Link<A, C>> => {
    // decrypt this link
    const encryptedLink = encryptedLinks[hash]!
    const decryptedLink =
      links[hash] ?? // if it's already decrypted, don't bother decrypting it again
      decryptLink(encryptedLink, keys)
    let newLinks = {
      [hash]: decryptedLink,
    }

    // decrypt its children
    const children = childMap[hash] ?? []
    for (const hash of children) {
      newLinks = { ...newLinks, ...decrypt(hash, newLinks) }
    }

    return { ...prevLinks, ...newLinks }
  }

  const decryptedLinks = decrypt(root)

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
