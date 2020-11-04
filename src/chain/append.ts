import { signatures } from '@herbcaudill/crypto'
import { EMPTY_CHAIN } from './create'
import { hashLink } from './hashLink'
import { LocalUserContext, redactContext } from '/context'
import { LinkBody, SignatureChain, SignedLink } from '/chain'

export const append = <T extends LinkBody>(
  chain: SignatureChain<T> | typeof EMPTY_CHAIN,
  link: Partial<T>,
  context: LocalUserContext
): SignatureChain<T> => {
  // chain to previous head
  const body = {
    ...link,
    context: redactContext(context),
    timestamp: new Date().getTime(),
    prev: chain.head,
  } as T

  const { userName, keys } = context.user
  const hash = hashLink(body)

  // attach signature
  const signedLink = {
    body,
    hash,
    signed: {
      userName,
      signature: signatures.sign(body, keys.signature.secretKey),
      key: keys.signature.publicKey,
    },
  } as SignedLink<T>

  // clone the previous map of links and add the new one
  const links = { ...chain.links, [hash]: signedLink }

  // return new chain
  const root = chain.root ?? hash // if the root is null, this was the first link
  const head = hash
  return { root, head, links } as SignatureChain<T>
}
