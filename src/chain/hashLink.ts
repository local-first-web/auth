import { LinkBody } from '/chain/types'
import { hash } from '/crypto'
import { base64, HashPurpose } from '/util'

export const hashLink = (body: LinkBody) => base64.encode(hash(HashPurpose.LinkToPrevious, body))
