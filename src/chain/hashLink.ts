import { SignedLink } from './types'
import { hash, base64 } from '../lib'
import { HashPurpose } from '../lib/constants'

export const hashLink = (link: SignedLink) =>
  base64.encode(hash(HashPurpose.LinkToPrevious, link))
