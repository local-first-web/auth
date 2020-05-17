import { base64, HashPurpose } from '/lib'
import { hash } from '/crypto'
import { SignedLink } from '/chain/types'

export const hashLink = (link: SignedLink) =>
  base64.encode(hash(HashPurpose.LinkToPrevious, link))
