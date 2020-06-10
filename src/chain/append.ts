import { LocalUserContext, redactContext } from '/context'
import { signatures } from '/crypto'
import { User } from '/user'
import { hashLink } from '/chain/hashLink'
import { LinkBody, PartialLinkBody, SignatureChain, SignedLink } from '/chain/types'

export const append = <T extends LinkBody = LinkBody>(
  chain: SignatureChain<SignedLink<T>>,
  link: PartialLinkBody,
  context: LocalUserContext
) => {
  const linkWithContext = {
    ...link,
    context: redactContext(context),
  }
  const chainedLink = chainToPreviousLink(chain, linkWithContext)
  const signedLink = signLink(chainedLink, context.user)
  return [...chain, signedLink] as SignatureChain<SignedLink<T>>
}

const signLink = <T extends LinkBody = LinkBody>(body: T, userWithSecrets: User) => {
  const { userName, keys } = userWithSecrets
  const { publicKey, secretKey } = keys.signature

  const signature = signatures.sign(body, secretKey)
  return {
    body,
    signed: { userName, signature, key: publicKey },
  } as SignedLink<T>
}

const chainToPreviousLink = <T extends LinkBody = LinkBody>(
  chain: SignatureChain<SignedLink<T>>,
  link: PartialLinkBody<T>
) => {
  const timestamp = new Date().getTime()
  if (chain.length === 0)
    return {
      ...link,
      timestamp,
      prev: null,
      index: 0,
    } as T

  const prevLink = chain[chain.length - 1]
  const index = (prevLink.body.index || 0) + 1
  const prevLinkHash = hashLink(prevLink)
  return {
    ...link,
    timestamp,
    prev: prevLinkHash,
    index,
  } as T
}
