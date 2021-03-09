import { signatures } from '@herbcaudill/crypto'
import { EMPTY_CHAIN } from '@/chain/create'
import { Action, NonRootLinkBody, SignatureChain, SignedLink } from '@/chain/types'
import { hashLink } from '@/chain/hashLink'
import { LocalUserContext, redactContext } from '@/context'

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

  const { userName, deviceName } = context.device
  const keys = context.user.keys
  const hash = hashLink(body)

  // attach signature
  const signedLink: SignedLink<NonRootLinkBody<A>, A> = {
    body,
    hash,
    signed: {
      userName,
      deviceName,
      signature: signatures.sign(body, keys.signature.secretKey),
      key: keys.signature.publicKey,
    },
  }

  // clone the previous map of links and add the new one
  const links = { ...chain.links, [hash]: signedLink }

  // return new chain
  const root = chain.root ?? hash // if the root is null, this was the first link
  const head = hash
  return { root, head, links } as SignatureChain<A>
}
