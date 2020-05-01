import { SignedLink } from './types'
import { hmac, base64 } from '../lib'
import { HASH_PURPOSE } from '../constants'

export const hashLink = (link: SignedLink) =>
  base64.encode(hmac(HASH_PURPOSE.LINK_TO_PREVIOUS, link))
