import { SignedLink } from './types'
import { hmac, base64 } from '../lib'
import { HashPurpose } from '../lib/constants'

export const hashLink = (link: SignedLink) =>
  base64.encode(hmac(HashPurpose.LinkToPrevious, link))
