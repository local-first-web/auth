import { asymmetric } from '@localfirst/crypto'
import { EMPTY_GRAPH } from './createGraph'
import { hashEncryptedLink } from './hashLink'
import { Action, EncryptedLink, Graph, Link, LinkBody } from './types'
import { KeysetWithSecrets } from '/keyset'
import { UserWithSecrets } from '/user'
import { UnixTimestamp } from '/util'

interface AppendParams<A extends Action, C> {
  /** The graph to append a link to. */
  graph: Graph<A, C> | typeof EMPTY_GRAPH

  /** The action (type & payload) being added to the graph. */
  action: A

  /** User object for the author of this link. */
  user: UserWithSecrets

  /** Any additional context provided by the application. */
  context?: C

  /** Keyset used to encrypt & decrypt the link. */
  keys: KeysetWithSecrets
}

export const append = <A extends Action, C>({
  graph,
  action,
  user,
  context = {} as C,
  keys,
}: AppendParams<A, C>): Graph<A, C> => {
  // the "sender" of this encrypted link is the user authoring the link
  const { publicKey: senderPublicKey, secretKey: senderSecretKey } = user.keys.encryption

  // the "recipient" of this encrypted link is whoever knows the secret keys - e.g. in localfirst/auth, the current Team keys
  const { publicKey: recipientPublicKey } = keys.encryption

  // create unencrypted body
  const body: LinkBody<A, C> = {
    ...action,
    ...context,
    userId: user.userId,
    timestamp: new Date().getTime() as UnixTimestamp,
    prev: graph.head ?? [], // If there are no previous heads, this is the root node
  }

  // create encrypted body
  const encryptedBody = asymmetric.encrypt({
    secret: body,
    recipientPublicKey,
    senderSecretKey,
  })

  // the link's hash is calculated over the encrypted body
  const hash = hashEncryptedLink(encryptedBody)

  // create the encrypted and unencrypted links
  const link: Link<A, C> = {
    hash,
    body,
  }
  const encryptedLink: EncryptedLink = {
    senderPublicKey,
    recipientPublicKey,
    encryptedBody,
  }

  // return new graph
  return {
    // if the graph didn't already have a root, this is it
    root: graph.root ?? hash,

    // we just added the new head, so we're guaranteed to only have one
    head: [hash],

    // add the new encryptedLink
    encryptedLinks: {
      ...graph.encryptedLinks,
      [hash]: encryptedLink,
    },

    // add the new unencrypted link
    links: {
      ...graph.links,
      [hash]: link,
    },
  }
}
