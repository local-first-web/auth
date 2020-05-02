import {
  SignatureChain,
  LinkBody,
  LocalUser,
  SignedLink,
  PartialLinkBody,
} from './types'
import { signatures } from '../lib'
import { hashLink } from './hashLink'

interface appendArgs {
  chain: SignatureChain
  link: PartialLinkBody
  localUser: LocalUser
}
export const append = ({ chain, link, localUser }: appendArgs) => {
  const chainedLink = chainToPrev(chain, link)
  const signedLink = signLink(chainedLink, localUser)
  return [...chain, signedLink]
}

const signLink = (body: LinkBody, localUser: LocalUser): SignedLink => {
  const { name, keys } = localUser
  const { publicKey, secretKey } = keys.signature

  const signature = signatures.sign(body, secretKey)
  return {
    body,
    signed: {
      name,
      signature,
      key: publicKey,
    },
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
    }

  const prevLink = chain[chain.length - 1]
  const index = (prevLink.body.index || 0) + 1
  const prevLinkHash = hashLink(prevLink)
  return {
    ...link,
    timestamp,
    prev: prevLinkHash,
    index,
  }
}
