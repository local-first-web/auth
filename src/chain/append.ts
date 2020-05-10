import { ContextWithSecrets, redactContext } from '../context'
import { signatures } from '../lib'
import { UserWithSecrets } from '../user'
import { hashLink } from './hashLink'
import { LinkBody, PartialLinkBody, SignatureChain, SignedLink } from './types'

export const append = (
  chain: SignatureChain,
  link: PartialLinkBody,
  context: ContextWithSecrets
) => {
  const linkWithContext = {
    ...link,
    context: redactContext(context),
  }
  const chainedLink = chainToPrev(chain, linkWithContext)
  const signedLink = signLink(chainedLink, context.user)
  return [...chain, signedLink]
}

const signLink = (
  body: LinkBody,
  userWithSecrets: UserWithSecrets
): SignedLink => {
  const { userName: name, keys } = userWithSecrets
  const { publicKey, secretKey } = keys.signature

  const signature = signatures.sign(body, secretKey)
  return {
    body,
    signed: { name, signature, key: publicKey },
  }
}

const chainToPrev = (
  chain: SignatureChain,
  link: PartialLinkBody
): LinkBody => {
  const timestamp = new Date().getTime()
  if (chain.length === 0)
    return {
      ...link,
      timestamp,
      prev: null,
      index: 0,
    } as LinkBody

  const prevLink = chain[chain.length - 1]
  const index = (prevLink.body.index || 0) + 1
  const prevLinkHash = hashLink(prevLink)
  return {
    ...link,
    timestamp,
    prev: prevLinkHash,
    index,
  } as LinkBody
}
