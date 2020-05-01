import { SignatureChain, LinkBody, LocalUser, SignedLink } from './types'
import { signatures, hmac, base64 } from 'lib'

interface appendArgs {
  chain: SignatureChain
  link: LinkBody
  localUser: LocalUser
}
export const append = ({ chain, link, localUser }: appendArgs) => {
  if (chain.length > 0) {
    const prevLink = chain[chain.length - 1]
    const prevLinkHash = base64.encode(hmac('SOMETHING', prevLink))
    link.prev = prevLinkHash
  }
  const signedLink = signLink(link, localUser)
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
