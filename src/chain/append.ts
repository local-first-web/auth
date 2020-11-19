import { signatures } from '@herbcaudill/crypto'
import { hashLink } from './hashLink'
import { LocalUserContext, redactContext } from '/context'
import { EMPTY_CHAIN, Action, SignatureChain, SignedLink, NonRootLinkBody } from '/chain'

export const append = <A extends Action>(
  chain: SignatureChain<A> | typeof EMPTY_CHAIN,
  action: A,
  context: LocalUserContext
): SignatureChain<A> => {
  // chain to previous head
  const body = {
    ...action,
    context: redactContext(context),
    timestamp: new Date().getTime(),
    prev: chain.head,
  } as NonRootLinkBody<A>

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
  } as SignedLink<NonRootLinkBody<A>, A>

  // clone the previous map of links and add the new one
  const links = { ...chain.links, [hash]: signedLink }

  // return new chain
  const root = chain.root ?? hash // if the root is null, this was the first link
  const head = hash
  return { root, head, links } as SignatureChain<A>
}
